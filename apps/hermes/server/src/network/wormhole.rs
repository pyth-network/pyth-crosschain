//! Wormhole gRPC Service
//!
//! This module defines a service that connects to a Wormhole gRPC server and subscribes to VAA
//! updates. These updates are then stored in Hermes and made available to the rest of the
//! application.

use {
    crate::{config::RunOptions, state::wormhole::Wormhole},
    anyhow::{anyhow, Result},
    futures::StreamExt,
    proto::spy::v1::{
        filter_entry::Filter, spy_rpc_service_client::SpyRpcServiceClient, EmitterFilter,
        FilterEntry, SubscribeSignedVaaRequest,
    },
    pythnet_sdk::ACCUMULATOR_EMITTER_ADDRESS,
    std::{sync::Arc, time::Duration},
    tokio::time::Instant,
    tonic::Request,
    wormhole_sdk::Chain,
};

pub type VaaBytes = Vec<u8>;

#[derive(Eq, PartialEq, Clone, Hash, Debug)]
pub struct GuardianSet {
    pub keys: Vec<[u8; 20]>,
}

impl std::fmt::Display for GuardianSet {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[")?;
        for (i, key) in self.keys.iter().enumerate() {
            // Comma separated printing of the keys using hex encoding.
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
#[allow(
    dead_code,
    reason = "we have to deserialize all fields but we don't use all of them"
)]
pub struct BridgeData {
    pub guardian_set_index: u32,
    pub last_lamports: u64,
    pub config: BridgeConfig,
}

/// BridgeConfig extracted from wormhole bridge account, due to no API.
#[derive(borsh::BorshDeserialize)]
#[allow(
    dead_code,
    reason = "we have to deserialize all fields but we don't use all of them"
)]
pub struct BridgeConfig {
    pub guardian_set_expiration_time: u32,
    pub fee: u64,
}

/// GuardianSetData extracted from wormhole bridge account, due to no API.
#[derive(borsh::BorshDeserialize)]
pub struct GuardianSetData {
    pub _index: u32,
    pub keys: Vec<[u8; 20]>,
    pub _creation_time: u32,
    pub _expiration_time: u32,
}

/// Wormhole `prost` compiled definitions.
///
/// We use `prost` to build the protobuf definitions from the upstream Wormhole repository. Which
/// outputs `.rs` files during execution of build.rs, these can be included into the source while
/// compilation is happening.
///
/// The following module structure must match the protobuf definitions, so that the generated code
/// can correctly reference modules from each other.
#[allow(
    clippy::enum_variant_names,
    clippy::allow_attributes_without_reason,
    reason = "generated code"
)]
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
pub async fn spawn<S>(opts: RunOptions, state: Arc<S>) -> Result<()>
where
    S: Wormhole,
    S: Send + Sync + 'static,
{
    let mut exit = crate::EXIT.subscribe();
    loop {
        let current_time = Instant::now();
        tokio::select! {
            _ = exit.changed() => break,
            Err(err) = run(opts.clone(), state.clone()) => {
                tracing::error!(error = ?err, "Wormhole gRPC service failed.");

                if current_time.elapsed() < Duration::from_secs(30) {
                    tracing::error!("Wormhole listener restarting too quickly. Sleep 1s.");
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }
    }
    tracing::info!("Shutting down Wormhole gRPC service...");
    Ok(())
}

#[tracing::instrument(skip(opts, state))]
async fn run<S>(opts: RunOptions, state: Arc<S>) -> Result<()>
where
    S: Wormhole,
    S: Send + Sync + 'static,
{
    let mut client = SpyRpcServiceClient::connect(opts.wormhole.spy_rpc_addr).await?;
    let mut stream = client
        .subscribe_signed_vaa(Request::new(SubscribeSignedVaaRequest {
            filters: vec![FilterEntry {
                filter: Some(Filter::EmitterFilter(EmitterFilter {
                    chain_id: Into::<u16>::into(Chain::Pythnet).into(),
                    emitter_address: hex::encode(ACCUMULATOR_EMITTER_ADDRESS),
                })),
            }],
        }))
        .await?
        .into_inner();

    while let Some(Ok(message)) = stream.next().await {
        let state = state.clone();
        tokio::spawn(async move {
            if let Err(e) = state.process_message(message.vaa_bytes).await {
                tracing::debug!(error = ?e, "Skipped VAA.");
            }
        });
    }

    Err(anyhow!("Wormhole gRPC stream terminated."))
}
