use ::time::OffsetDateTime;
use axum::{
    routing::{get, post},
    Json, Router,
};
use axum_prometheus::{EndpointLabel, PrometheusMetricLayerBuilder};
use clap::crate_version;
use secp256k1::{
    ecdsa::{RecoverableSignature, RecoveryId},
    Message, Secp256k1,
};
use serde::Deserialize;
use serde_wormhole::RawMessage;
use sha3::{Digest, Keccak256};
use std::{
    net::SocketAddr,
    time::{Duration, Instant},
};
use wormhole_sdk::{
    vaa::{Body, Header, Signature},
    GuardianAddress, GuardianSetInfo, Vaa,
};

use crate::{
    server::State,
    ws::{ws_route_handler, UpdateEvent},
};

pub type Payload<'a> = &'a RawMessage;

async fn root() -> String {
    format!("Quorum API {}", crate_version!())
}

pub async fn run(listen_address: SocketAddr, state: State) -> anyhow::Result<()> {
    tracing::info!("Starting server...");

    let (prometheus_layer, _) = PrometheusMetricLayerBuilder::new()
        .with_metrics_from_fn(|| state.metrics_recorder.clone())
        .with_endpoint_label_type(EndpointLabel::MatchedPathWithFallbackFn(|_| {
            "unknown".to_string()
        }))
        .build_pair();

    let routes = Router::new()
        .route("/", get(root))
        .route("/live", get(|| async { "OK" }))
        .route("/observation", post(post_observation))
        .route("/ws", get(ws_route_handler))
        .layer(prometheus_layer)
        .with_state(state);
    let listener = tokio::net::TcpListener::bind(&listen_address).await?;

    axum::serve(listener, routes)
        .with_graceful_shutdown(async {
            crate::server::wait_for_exit().await;
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
}

fn verify_observation(
    observation: &Observation,
    guardian_set: GuardianSetInfo,
    observation_lifetime: u32,
) -> anyhow::Result<usize> {
    let body = observation
        .get_body()
        .map_err(|e| anyhow::anyhow!("Failed to deserialize observation body: {}", e))?;

    if is_body_expired(&body, observation_lifetime) {
        return Err(anyhow::anyhow!("Observation is expired"));
    }

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
            "Signature does not match any guardian address, recovered address: {:}",
            hex::encode(address)
        ))
}

async fn run_expiration_loop(state: axum::extract::State<State>, observation: Observation) {
    loop {
        tokio::time::sleep(Duration::from_secs(state.observation_lifetime as u64)).await;

        let verification = state.verification.read().await;
        if !verification.contains_key(&observation.body) {
            break;
        }
        drop(verification); // Explicitly drop the read lock before acquiring a write lock

        let body = match observation.get_body() {
            Ok(body) => body,
            Err(e) => {
                tracing::warn!(error = ?e, "Failed to deserialize observation body");
                break;
            }
        };

        if is_body_expired(&body, state.observation_lifetime) {
            state.verification.write().await.remove(&observation.body);
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
    metrics::counter!(
        "verified_observations_total",
        &[("gaurdian_index", verifier_index.to_string())]
    )
    .increment(1);
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
        metrics::counter!("new_vaa_total").increment(1);
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
            let start = Instant::now();
            let mut status = "success";
            if let Err(e) = handle_observation(state, params).await {
                status = "error";
                tracing::warn!(error = ?e, "Failed to handle observation");
            }
            metrics::histogram!("handle_observation_duration_seconds", &[("status", status)])
                .record(start.elapsed().as_secs_f64());
        }
    });
    Json(())
}

#[cfg(test)]
mod test {
    use std::{collections::HashMap, sync::Arc};

    use crate::server::tests::get_state;
    use secp256k1::{
        rand::{self, seq::SliceRandom},
        Secp256k1,
    };
    use serde::Serialize;
    use tokio::{
        sync::RwLock,
        time::{sleep, timeout},
    };

    use super::*;

    fn sign<P: Serialize>(body: &Body<P>, secret_key: &secp256k1::SecretKey) -> [u8; 65] {
        let secp = Secp256k1::new();
        let digest = body.digest().unwrap();
        let message = Message::from_digest(digest.secp256k_hash);
        let (recid, signature) = secp
            .sign_ecdsa_recoverable(message, secret_key)
            .serialize_compact();
        let mut sig_bytes = [0u8; 65];
        sig_bytes[..64].copy_from_slice(&signature);
        sig_bytes[64] = recid as u8;
        sig_bytes
    }

    const OBSERVERATION_LIFETIME: u32 = 3;
    const SAMPLE_PAYLOAD: [u8; 5] = [4; 5];

    fn get_sample_body<'a>(expiration_offset: i64) -> Body<&'a RawMessage> {
        let body = Body {
            timestamp: (OffsetDateTime::now_utc().unix_timestamp() + expiration_offset) as u32,
            nonce: 0,
            sequence: 1,
            consistency_level: 2,
            emitter_chain: wormhole_sdk::Chain::Ethereum,
            emitter_address: wormhole_sdk::Address([3; 32]),
            payload: RawMessage::new(&SAMPLE_PAYLOAD),
        };
        body
    }

    fn get_new_keypair() -> (secp256k1::SecretKey, [u8; 20]) {
        let secp = Secp256k1::new();
        let (secret_key, public_key) = secp.generate_keypair(&mut rand::rng());
        let pubkey_uncompressed = public_key.serialize_uncompressed();
        let pubkey_hash: [u8; 32] = Keccak256::new_with_prefix(&pubkey_uncompressed[1..])
            .finalize()
            .into();
        let pubkey_evm: [u8; 20] = pubkey_hash[pubkey_hash.len() - 20..]
            .try_into()
            .expect("Invalid address length");
        (secret_key, pubkey_evm)
    }

    fn get_new_keypairs(n: usize) -> Vec<(secp256k1::SecretKey, [u8; 20])> {
        (0..n).map(|_| get_new_keypair()).collect()
    }

    fn get_guardian_sets(n: usize) -> (GuardianSetInfo, Vec<secp256k1::SecretKey>) {
        let keys = get_new_keypairs(n);
        let addresses: Vec<GuardianAddress> = keys
            .iter()
            .map(|(_, addr)| GuardianAddress(*addr))
            .collect();
        (
            GuardianSetInfo { addresses },
            keys.into_iter().map(|(key, _)| key).collect(),
        )
    }

    #[test]
    fn test_body_is_expired() {
        let body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 + 1));
        assert!(is_body_expired(&body, OBSERVERATION_LIFETIME));
    }

    #[test]
    fn test_body_is_not_expired() {
        let body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 - 1));
        assert!(!is_body_expired(&body, OBSERVERATION_LIFETIME));
    }

    #[test]
    fn test_observation_get_body() {
        let body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 - 1));
        let observation = Observation {
            signature: [0; 65],
            body: serde_wormhole::to_vec(&body).unwrap(),
        };
        assert_eq!(observation.get_body().unwrap(), body);
    }

    #[test]
    fn test_verify_observation() {
        let (guardian_set, keys) = get_guardian_sets(10);
        let signer_index = 7;
        let body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 - 1));
        let observation = Observation {
            signature: sign(&body, &keys[signer_index]),
            body: serde_wormhole::to_vec(&body).unwrap(),
        };
        let result = verify_observation(&observation, guardian_set.clone(), OBSERVERATION_LIFETIME);
        assert_eq!(result.unwrap(), signer_index);
    }

    #[test]
    fn test_verify_observation_is_expired() {
        let (guardian_set, keys) = get_guardian_sets(10);
        let signer_index = 7;
        let body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 + 1));
        let observation = Observation {
            signature: sign(&body, &keys[signer_index]),
            body: serde_wormhole::to_vec(&body).unwrap(),
        };
        let result = verify_observation(&observation, guardian_set.clone(), OBSERVERATION_LIFETIME);
        assert_eq!(result.unwrap_err().to_string(), "Observation is expired");
    }

    #[test]
    fn test_verify_observation_invalid_body() {
        let (guardian_set, keys) = get_guardian_sets(10);
        let signer_index = 7;
        let body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 - 1));
        let mut body_bytes = serde_wormhole::to_vec(&body).unwrap();
        body_bytes.truncate(10); // remove most of the data
        let observation = Observation {
            signature: sign(&body, &keys[signer_index]),
            body: body_bytes,
        };
        let result = verify_observation(&observation, guardian_set.clone(), OBSERVERATION_LIFETIME);
        assert_eq!(
            result.unwrap_err().to_string(),
            "Failed to deserialize observation body: unexpected end of input"
        );
    }

    #[test]
    fn test_verify_observation_invalid_signature() {
        let (guardian_set, _) = get_guardian_sets(10);
        let (key, address) = get_new_keypair();
        let body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 - 1));
        let observation = Observation {
            signature: sign(&body, &key),
            body: serde_wormhole::to_vec(&body).unwrap(),
        };
        let result = verify_observation(&observation, guardian_set.clone(), OBSERVERATION_LIFETIME);
        assert_eq!(
            result.unwrap_err().to_string(),
            format!(
                "Signature does not match any guardian address, recovered address: {}",
                hex::encode(address)
            )
        );
    }

    #[tokio::test]
    async fn test_expiration_loop_expired() {
        let body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 - 1));
        let (guardian_set, keys) = get_guardian_sets(10);
        let observation = Observation {
            signature: sign(&body, &keys[0]),
            body: serde_wormhole::to_vec(&body).unwrap(),
        };
        let body = serde_wormhole::to_vec(&body).unwrap();
        let state = get_state(
            Arc::new(RwLock::new(HashMap::new())),
            guardian_set,
            OBSERVERATION_LIFETIME,
        );
        let result = timeout(
            Duration::from_secs((OBSERVERATION_LIFETIME * 3) as u64),
            async {
                state.verification.write().await.insert(
                    body.clone(),
                    vec![Signature {
                        signature: observation.signature,
                        index: 0,
                    }],
                );
                assert_eq!(
                    state
                        .verification
                        .read()
                        .await
                        .get(&body.clone())
                        .unwrap()
                        .len(),
                    1
                );
                run_expiration_loop(axum::extract::State(state.clone()), observation).await;
            },
        )
        .await;

        assert!(result.is_ok(), "Test failed due to timeout");
        assert_eq!(
            state.verification.read().await.len(),
            0,
            "Verification map should be empty after expiration loop"
        );
    }

    #[tokio::test]
    async fn test_expiration_loop_remove_before_expiration() {
        let body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 - 1));
        let (guardian_set, keys) = get_guardian_sets(10);
        let observation = Observation {
            signature: sign(&body, &keys[0]),
            body: serde_wormhole::to_vec(&body).unwrap(),
        };
        let body = serde_wormhole::to_vec(&body).unwrap();
        let state = get_state(
            Arc::new(RwLock::new(HashMap::new())),
            guardian_set,
            OBSERVERATION_LIFETIME,
        );
        let result = timeout(
            Duration::from_secs((OBSERVERATION_LIFETIME + 1) as u64),
            async {
                state.verification.write().await.insert(
                    body.clone(),
                    vec![Signature {
                        signature: observation.signature,
                        index: 0,
                    }],
                );
                assert_eq!(
                    state
                        .verification
                        .read()
                        .await
                        .get(&body.clone())
                        .unwrap()
                        .len(),
                    1
                );
                state.verification.write().await.remove(&body.clone());
                run_expiration_loop(axum::extract::State(state.clone()), observation).await;
            },
        )
        .await;

        assert!(result.is_ok(), "Test failed due to timeout");
        assert_eq!(
            state.verification.read().await.len(),
            0,
            "Verification map should be empty after expiration loop"
        );
    }

    #[tokio::test]
    async fn test_expiration_loop_higher_expiration_than_timeout() {
        let timeout_duration = (OBSERVERATION_LIFETIME + 2) as u64;
        let mut body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 - 1));

        // We should make sure the loop is going to run at least once
        // So we need to set time duration to be higher than the observation lifetime
        // And to make sure we are not going to remove the observation before the timeout
        // We need to set the timestamp to be in the future
        body.timestamp = (OffsetDateTime::now_utc().unix_timestamp() + 2_i64) as u32;

        let (guardian_set, keys) = get_guardian_sets(10);
        let observation = Observation {
            signature: sign(&body, &keys[0]),
            body: serde_wormhole::to_vec(&body).unwrap(),
        };
        let body = serde_wormhole::to_vec(&body).unwrap();
        let state = get_state(
            Arc::new(RwLock::new(HashMap::new())),
            guardian_set,
            OBSERVERATION_LIFETIME,
        );
        let result = timeout(Duration::from_secs(timeout_duration), async {
            state.verification.write().await.insert(
                body.clone(),
                vec![Signature {
                    signature: observation.signature,
                    index: 0,
                }],
            );
            assert_eq!(
                state
                    .verification
                    .read()
                    .await
                    .get(&body.clone())
                    .unwrap()
                    .len(),
                1
            );
            run_expiration_loop(axum::extract::State(state.clone()), observation).await;
        })
        .await;

        assert!(
            result.is_err(),
            "Test should have timed out, as the observation is not expired yet"
        );
        assert_eq!(state.verification.read().await.len(), 1,
            "Verification map should not be empty after expiration loop, as the observation is not expired yet");
    }

    #[tokio::test]
    async fn test_handle_observation() {
        let total_observations = 19;
        let quorum = (total_observations * 2) / 3 + 1;
        assert!(
            quorum < total_observations,
            "Quorum should be less than total observations"
        );

        let sample_body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 - 1));
        let (guardian_set, keys) = get_guardian_sets(19);

        // Shuffle the keys to ensure randomness in the test
        let mut keys = keys.iter().enumerate().collect::<Vec<_>>();
        keys.shuffle(&mut rand::rng());
        let observations: Vec<Observation> = keys
            .iter()
            .map(|key| Observation {
                signature: sign(&sample_body, key.1),
                body: serde_wormhole::to_vec(&sample_body).unwrap(),
            })
            .collect();

        let signatures: Vec<Signature> = observations
            .iter()
            .enumerate()
            .map(|(i, obs)| Signature {
                signature: obs.signature,
                index: keys[i].0 as u8,
            })
            .collect();
        let body = serde_wormhole::to_vec(&sample_body).unwrap();
        let state = get_state(
            Arc::new(RwLock::new(HashMap::new())),
            guardian_set,
            OBSERVERATION_LIFETIME,
        );

        let mut subscriber = state.ws.broadcast_sender.subscribe();
        for (i, observation) in observations.iter().enumerate() {
            if i > quorum {
                // It should be once removed from the verification map
                assert_eq!(
                    state
                        .verification
                        .read()
                        .await
                        .get(&body.clone())
                        .unwrap()
                        .len(),
                    i - quorum
                );
            } else if i < quorum && i > 0 {
                assert_eq!(
                    state
                        .verification
                        .read()
                        .await
                        .get(&body.clone())
                        .unwrap()
                        .len(),
                    i
                );
            }
            assert!(
                handle_observation(axum::extract::State(state.clone()), observation.clone())
                    .await
                    .is_ok()
            );

            if i == quorum - 1 {
                // Ensure we have reached the quorum
                let update = subscriber
                    .try_recv()
                    .expect("Failed to receive update from subscriber");
                let UpdateEvent::NewVaa(vaa) = update else {
                    panic!("Expected NewVaa event, got {update:?}");
                };
                let vaa: Vaa<&RawMessage> =
                    serde_wormhole::from_slice(&vaa).expect("Failed to deserialize VAA");
                // Check if the vaa signatures are sorted
                for i in 0..vaa.signatures.len() {
                    if i > 0 {
                        assert!(
                            vaa.signatures[i].index > vaa.signatures[i - 1].index,
                            "Signature should be sorted"
                        );
                    }
                }

                let mut expected_signatures = signatures[0..quorum].to_vec();
                expected_signatures.sort();
                let expected_vaa: Vaa<&RawMessage> = (
                    Header {
                        version: 1,
                        guardian_set_index: 0,
                        signatures: expected_signatures,
                    },
                    sample_body.clone(),
                )
                    .into();

                assert_eq!(
                    vaa, expected_vaa,
                    "VAA should match the expected VAA with the correct signatures"
                );
            }
        }

        // Ensure no new VAA is sent
        let result = subscriber.try_recv();
        assert!(
            result.is_err(),
            "No new VAA should be sent after reaching the quorum"
        );

        // Wait for the observation to expire
        sleep(Duration::from_secs((OBSERVERATION_LIFETIME * 2 + 1) as u64)).await;
        assert_eq!(
            state.verification.read().await.len(),
            0,
            "Verification map should be empty after handling all observations"
        );
    }

    #[tokio::test]
    async fn test_handle_observation_no_quorum() {
        let body = get_sample_body(-(OBSERVERATION_LIFETIME as i64 - 1));
        let (guardian_set, keys) = get_guardian_sets(19);

        let observations: Vec<Observation> = (0..12)
            .map(|i| Observation {
                signature: sign(&body, &keys[i]),
                body: serde_wormhole::to_vec(&body).unwrap(),
            })
            .collect();

        let body = serde_wormhole::to_vec(&body).unwrap();
        let state = get_state(
            Arc::new(RwLock::new(HashMap::new())),
            guardian_set,
            OBSERVERATION_LIFETIME,
        );

        assert_eq!(state.verification.read().await.len(), 0);
        for (i, observation) in observations.iter().enumerate() {
            if i != 0 {
                assert_eq!(
                    state
                        .verification
                        .read()
                        .await
                        .get(&body.clone())
                        .unwrap()
                        .len(),
                    i
                );
            }
            assert!(
                handle_observation(axum::extract::State(state.clone()), observation.clone())
                    .await
                    .is_ok()
            );
        }
        assert_eq!(state.verification.read().await.len(), 1,
            "Verification map should not be empty after handling all observations, as there is no quorum yet");

        // Wait for the observation to expire
        sleep(Duration::from_secs((OBSERVERATION_LIFETIME * 2 + 1) as u64)).await;

        assert_eq!(state.verification.read().await.len(), 0,
            "Verification map should not be empty after handling all observations, as there is no quorum yet");
    }
}
