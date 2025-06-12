use ::time::OffsetDateTime;
use axum::{
    routing::{get, post},
    Json, Router,
};
use secp256k1::{
    ecdsa::{RecoverableSignature, RecoveryId},
    Message, Secp256k1,
};
use serde::Deserialize;
use serde_wormhole::RawMessage;
use sha3::{Digest, Keccak256};
use std::{net::SocketAddr, time::Duration};
use wormhole_sdk::{
    vaa::{Body, Header, Signature},
    GuardianAddress, GuardianSetInfo, Vaa,
};

use crate::{
    server::State,
    ws::{ws_route_handler, UpdateEvent},
};

pub type Payload<'a> = &'a RawMessage;

pub async fn run(listen_address: SocketAddr, state: State) -> anyhow::Result<()> {
    tracing::info!("Starting server...");

    let routes = Router::new()
        .route("/live", get(|| async { "OK" }))
        .route("/observation", post(post_observation))
        .route("/ws", get(ws_route_handler))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind(&listen_address).await?;

    axum::serve(listener, routes)
        .with_graceful_shutdown(async {
            let _ = crate::server::EXIT.subscribe().changed().await;
            tracing::info!("Shutting down server...");
        })
        .await?;

    Ok(())
}

#[derive(Deserialize, Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Observation {
    #[serde(with = "hex::serde")]
    pub signature: [u8; 65],
    // serde wormhole serialized Body<&RawMessage>
    pub body: Vec<u8>,
}

fn is_body_expired(body: &Body<Payload>, observation_lifetime: u32) -> bool {
    let deadline = (body.timestamp + observation_lifetime) as i64;
    deadline < OffsetDateTime::now_utc().unix_timestamp()
}

impl Observation {
    fn get_body(&self) -> Result<Body<Payload>, serde_wormhole::Error> {
        serde_wormhole::from_slice(self.body.as_slice())
    }
    pub fn is_expired(&self, observation_lifetime: u32) -> bool {
        match self.get_body() {
            Ok(body) => is_body_expired(&body, observation_lifetime),
            Err(_) => {
                tracing::warn!("Failed to deserialize observation body");
                true
            }
        }
    }
}

fn verify_observation(
    observation: &Observation,
    guardian_set: GuardianSetInfo,
    observation_lifetime: u32,
) -> anyhow::Result<usize> {
    if observation.is_expired(observation_lifetime) {
        return Err(anyhow::anyhow!("Observation is expired"));
    }

    let body = observation
        .get_body()
        .map_err(|e| anyhow::anyhow!("Failed to deserialize observation body: {}", e))?;
    let digest = body.digest()?;
    let secp = Secp256k1::new();
    let recid = RecoveryId::try_from(observation.signature[64] as i32)?;
    let pubkey: &[u8; 65] = &secp
        .recover_ecdsa(
            Message::from_digest(digest.secp256k_hash),
            &RecoverableSignature::from_compact(&observation.signature[..64], recid)?,
        )?
        .serialize_uncompressed();
    let address: [u8; 32] = Keccak256::new_with_prefix(&pubkey[1..]).finalize().into();
    let address: [u8; 20] = address[address.len() - 20..].try_into()?;

    guardian_set
        .addresses
        .iter()
        .position(|addr| *addr == GuardianAddress(address))
        .ok_or(anyhow::anyhow!(
            "Signature does not match any guardian address"
        ))
}

async fn run_expiration_loop(state: axum::extract::State<State>, observation: Observation) {
    loop {
        tokio::time::sleep(Duration::from_secs(state.observation_lifetime as u64)).await;

        let verification = state.verification.read().await;
        if !verification.contains_key(&observation.body) {
            break;
        }

        if observation.is_expired(state.observation_lifetime) {
            let mut verification = state.verification.write().await;
            verification.remove(&observation.body);
            break;
        }
    }
}

async fn handle_observation(
    state: axum::extract::State<State>,
    params: Observation,
) -> Result<(), anyhow::Error> {
    let verifier_index = verify_observation(
        &params,
        state.guardian_set.clone(),
        state.observation_lifetime,
    )?;
    let new_signature = Signature {
        signature: params.signature,
        index: verifier_index.try_into()?,
    };

    let mut verification_writer = state.verification.write().await;
    let signatures = verification_writer
        .entry(params.body.clone())
        .and_modify(|sigs| {
            if sigs.iter().all(|sig| sig.index != new_signature.index) {
                sigs.push(new_signature);
                sigs.sort_by(|a, b| a.index.cmp(&b.index));
            }
        })
        .or_insert_with(|| vec![new_signature])
        .clone();

    let body = params
        .get_body()
        .map_err(|e| anyhow::anyhow!("Failed to deserialize observation body: {}", e))?;
    if signatures.len() > (state.guardian_set.addresses.len() * 2) / 3 {
        let vaa: Vaa<Payload> = (
            Header {
                version: 1,
                guardian_set_index: state.guardian_set_index,
                signatures,
            },
            body,
        )
            .into();
        if let Err(e) = state
            .ws
            .broadcast_sender
            .send(UpdateEvent::NewVaa(serde_wormhole::to_vec(&vaa).map_err(
                |e| anyhow::anyhow!("Failed to serialize VAA: {}", e),
            )?))
        {
            tracing::error!(error = ?e, "Failed to broadcast new VAA");
        }
        verification_writer.remove(&params.body);
    } else {
        tokio::spawn(run_expiration_loop(state.clone(), params));
    }

    Ok(())
}

async fn post_observation(
    state: axum::extract::State<State>,
    Json(params): Json<Observation>,
) -> Json<()> {
    tokio::spawn({
        let state = state.clone();
        async move {
            if let Err(e) = handle_observation(state, params).await {
                tracing::warn!(error = ?e, "Failed to handle observation");
            }
        }
    });
    Json(())
}
