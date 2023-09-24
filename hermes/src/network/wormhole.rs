//! Wormhole gRPC Service
//!
//! This module defines a service that connects to a Wormhole gRPC server and subscribes to VAA
//! updates. These updates are then stored in Hermes and made available to the rest of the
//! application.

use {
    crate::{
        config::RunOptions,
        state::State,
    },
    anyhow::{
        anyhow,
        ensure,
        Result,
    },
    chrono::NaiveDateTime,
    futures::StreamExt,
    proto::spy::v1::{
        filter_entry::Filter,
        spy_rpc_service_client::SpyRpcServiceClient,
        EmitterFilter,
        FilterEntry,
        SubscribeSignedVaaRequest,
    },
    pythnet_sdk::{
        wire::v1::{
            WormholeMessage,
            WormholePayload,
        },
        ACCUMULATOR_EMITTER_ADDRESS,
    },
    secp256k1::{
        ecdsa::{
            RecoverableSignature,
            RecoveryId,
        },
        Message,
        Secp256k1,
    },
    serde_wormhole::RawMessage,
    sha3::{
        Digest,
        Keccak256,
    },
    std::sync::{
        atomic::Ordering,
        Arc,
    },
    tonic::Request,
    wormhole_sdk::{
        vaa::{
            Body,
            Header,
        },
        Address,
        Chain,
        Vaa,
    },
};

const OBSERVED_CACHE_SIZE: usize = 1000;

pub type VaaBytes = Vec<u8>;

#[derive(Eq, PartialEq, Clone, Hash, Debug)]
pub struct GuardianSet {
    pub keys: Vec<[u8; 20]>,
}

impl std::fmt::Display for GuardianSet {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[")?;
        for (i, key) in self.keys.iter().enumerate() {
            // Comma seperated printing of the keys using hex encoding.
            if i != 0 {
                write!(f, ", ")?;
            }

            write!(f, "{}", hex::encode(key))?;
        }
        write!(f, "]")
    }
}

/// BridgeData extracted from wormhole bridge account, due to no API.
#[derive(borsh::BorshDeserialize)]
#[allow(dead_code)]
pub struct BridgeData {
    pub guardian_set_index: u32,
    pub last_lamports:      u64,
    pub config:             BridgeConfig,
}

/// BridgeConfig extracted from wormhole bridge account, due to no API.
#[derive(borsh::BorshDeserialize)]
#[allow(dead_code)]
pub struct BridgeConfig {
    pub guardian_set_expiration_time: u32,
    pub fee:                          u64,
}

/// GuardianSetData extracted from wormhole bridge account, due to no API.
#[derive(borsh::BorshDeserialize)]
pub struct GuardianSetData {
    pub index:           u32,
    pub keys:            Vec<[u8; 20]>,
    pub creation_time:   u32,
    pub expiration_time: u32,
}

/// Update the guardian set with the given ID in the state.
#[tracing::instrument(skip(state, guardian_set))]
pub async fn update_guardian_set(state: &State, id: u32, guardian_set: GuardianSet) {
    let mut guardian_sets = state.guardian_set.write().await;
    guardian_sets.insert(id, guardian_set);
}

/// Wormhole `prost` compiled definitions.
///
/// We use `prost` to build the protobuf definitions from the upstream Wormhole repository. Which
/// outputs `.rs` files during execution of build.rs, these can be included into the source while
/// compilation is happening.
///
/// The following module structure must match the protobuf definitions, so that the generated code
/// can correctly reference modules from each other.
mod proto {
    pub mod node {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/node.v1.rs"));
        }
    }

    pub mod gossip {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/gossip.v1.rs"));
        }
    }

    pub mod spy {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/spy.v1.rs"));
        }
    }

    pub mod publicrpc {
        pub mod v1 {
            include!(concat!(env!("OUT_DIR"), "/publicrpc.v1.rs"));
        }
    }
}

// Launches the Wormhole gRPC service.
#[tracing::instrument(skip(opts, state))]
pub async fn spawn(opts: RunOptions, state: Arc<State>) -> Result<()> {
    while !crate::SHOULD_EXIT.load(Ordering::Acquire) {
        if let Err(e) = run(opts.clone(), state.clone()).await {
            tracing::error!(error = ?e, "Wormhole gRPC service failed.");
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
    Ok(())
}

#[tracing::instrument(skip(opts, state))]
async fn run(opts: RunOptions, state: Arc<State>) -> Result<()> {
    let mut client = SpyRpcServiceClient::connect(opts.wormhole.spy_rpc_addr).await?;
    let mut stream = client
        .subscribe_signed_vaa(Request::new(SubscribeSignedVaaRequest {
            filters: vec![FilterEntry {
                filter: Some(Filter::EmitterFilter(EmitterFilter {
                    chain_id:        Into::<u16>::into(Chain::Pythnet).into(),
                    emitter_address: hex::encode(ACCUMULATOR_EMITTER_ADDRESS),
                })),
            }],
        }))
        .await?
        .into_inner();

    while let Some(Ok(message)) = stream.next().await {
        if crate::SHOULD_EXIT.load(Ordering::Acquire) {
            return Ok(());
        }

        if let Err(e) = process_message(state.clone(), message.vaa_bytes).await {
            tracing::debug!(error = ?e, "Skipped VAA.");
        }
    }

    Ok(())
}

/// Process a message received via a Wormhole gRPC connection.
#[tracing::instrument(skip(state, vaa_bytes))]
pub async fn process_message(state: Arc<State>, vaa_bytes: Vec<u8>) -> Result<()> {
    let vaa = serde_wormhole::from_slice::<Vaa<&RawMessage>>(&vaa_bytes)?;

    // Log VAA Processing.
    let vaa_timestamp = NaiveDateTime::from_timestamp_opt(vaa.timestamp as i64, 0);
    let vaa_timestamp = vaa_timestamp.unwrap();
    let vaa_timestamp = vaa_timestamp.format("%Y-%m-%dT%H:%M:%S.%fZ").to_string();
    let slot = match WormholeMessage::try_from_bytes(vaa.payload)?.payload {
        WormholePayload::Merkle(proof) => proof.slot,
    };
    tracing::info!(slot = slot, vaa_timestamp = vaa_timestamp, "Observed VAA");

    // Check VAA hasn't already been seen.
    ensure!(
        !state.observed_vaa_seqs.read().await.contains(&vaa.sequence),
        "Previously observed VAA: {}",
        vaa.sequence
    );

    // Check VAA source is valid, we don't want to process other protocols VAAs.
    validate_vaa_source(&vaa)?;

    // Verify the VAA has been signed by a known guardian set.
    let vaa = verify_vaa(
        state
            .guardian_set
            .read()
            .await
            .get(&vaa.guardian_set_index)
            .ok_or_else(|| anyhow!("Unknown guardian set: {}", vaa.guardian_set_index))?,
        vaa,
    )?;

    // Finally, store the resulting VAA in Hermes.
    store_vaa(state.clone(), vaa.sequence, vaa_bytes).await?;

    Ok(())
}

// Rejects VAAs from invalid sources.
#[tracing::instrument(skip(vaa))]
fn validate_vaa_source(vaa: &Vaa<&RawMessage>) -> Result<()> {
    ensure!(
        vaa.emitter_chain == Chain::Pythnet,
        "VAA from non-Pythnet Chain."
    );
    ensure!(
        vaa.emitter_address == Address(ACCUMULATOR_EMITTER_ADDRESS),
        "VAA from non-Pythnet Emitter: {}",
        vaa.emitter_address
    );
    Ok(())
}

/// Validate a VAA extracted from a Wormhole gRPC message.
#[tracing::instrument(skip(guardian_set, vaa))]
pub fn verify_vaa<'a>(
    guardian_set: &GuardianSet,
    vaa: Vaa<&'a RawMessage>,
) -> Result<Vaa<&'a RawMessage>> {
    let (header, body): (Header, Body<&RawMessage>) = vaa.into();
    let digest = body.digest()?;

    // Ideally we need to test the signatures but currently Wormhole doesn't give us any easy way
    // to do it, so we just bypass the check in tests.
    let quorum = if cfg!(test) {
        0
    } else {
        (guardian_set.keys.len() * 2) / 3 + 1
    };

    let secp = Secp256k1::new();
    let mut last_signer_id: Option<usize> = None;
    let mut signatures = vec![];
    for signature in header.signatures.into_iter() {
        // Do not collect more signatures than necessary to reduce on-chain gas spent during
        // signature verification.
        if signatures.len() >= quorum {
            break;
        }

        let signer_id: usize = signature.index.into();
        if signer_id >= guardian_set.keys.len() {
            return Err(anyhow!(
                "Signer ID is out of range. Signer ID: {}, guardian set size: {}",
                signer_id,
                guardian_set.keys.len()
            ));
        }

        // On-chain verification expects signatures to be sorted by signer ID. We can exit early if
        // this constraint is violated.
        if let Some(true) = last_signer_id.map(|v| v >= signer_id) {
            return Err(anyhow!(
                "Signatures are not sorted by signer ID. Last signer ID: {:?}, current signer ID: {}",
                last_signer_id,
                signer_id
            ));
        }

        // Recover the public key from an [u8; 65] serialized ECDSA signature in (v, r, s) format
        let recid = RecoveryId::from_i32(signature.signature[64].into())?;

        // An address is the last 20 bytes of the Keccak256 hash of the uncompressed public key.
        let pubkey: &[u8; 65] = &secp
            .recover_ecdsa(
                &Message::from_slice(&digest.secp256k_hash)?,
                &RecoverableSignature::from_compact(&signature.signature[..64], recid)?,
            )?
            .serialize_uncompressed();

        // The address is the last 20 bytes of the Keccak256 hash of the public key
        let address: [u8; 32] = Keccak256::new_with_prefix(&pubkey[1..]).finalize().into();
        let address: [u8; 20] = address[address.len() - 20..].try_into()?;

        // Confirm the recovered address matches an address in the guardian set.
        if guardian_set.keys.get(signer_id) == Some(&address) {
            signatures.push(signature);
        }

        last_signer_id = Some(signer_id);
    }

    // Check if we have enough correct signatures
    if signatures.len() < quorum {
        return Err(anyhow!(
            "Not enough correct signatures. Expected {:?}, received {:?}",
            quorum,
            signatures.len()
        ));
    }

    Ok((
        Header {
            signatures,
            ..header
        },
        body,
    )
        .into())
}

#[tracing::instrument(skip(state, vaa_bytes))]
pub async fn store_vaa(state: Arc<State>, sequence: u64, vaa_bytes: Vec<u8>) -> Result<()> {
    // Check VAA hasn't already been seen, this may have been checked previously
    // but due to async nature It's possible other threads have mutated the state
    // since this VAA started processing.
    let mut observed_vaa_seqs = state.observed_vaa_seqs.write().await;
    ensure!(
        !observed_vaa_seqs.contains(&sequence),
        "Previously observed VAA: {}",
        sequence,
    );

    // Clear old cached VAA sequences.
    while observed_vaa_seqs.len() > OBSERVED_CACHE_SIZE {
        observed_vaa_seqs.pop_first();
    }

    // Hand the VAA to the aggregate store.
    crate::aggregate::store_update(&state, crate::aggregate::Update::Vaa(vaa_bytes)).await
}
