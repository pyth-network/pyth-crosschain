use axum_prometheus::metrics_exporter_prometheus::PrometheusHandle;
use clap::{crate_authors, crate_description, crate_name, crate_version, Args, Parser};
use lazy_static::lazy_static;
use solana_client::client_error::reqwest::Url;
use solana_sdk::pubkey::Pubkey;
use std::{
    collections::HashMap, future::Future, net::SocketAddr, ops::Deref, sync::Arc, time::Duration,
};
use tokio::{
    sync::{watch, RwLock},
    time::sleep,
};
use wormhole_sdk::{vaa::Signature, GuardianSetInfo};

use crate::{
    api::{self},
    metrics_server::{self, metric_collector, setup_metrics_recorder},
    pythnet::fetch_guardian_set,
    ws::WsState,
};

const DEFAULT_LISTEN_ADDR: &str = "127.0.0.1:9000";
const DEFAULT_METRICS_ADDR: &str = "127.0.0.1:9001";

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Server Options")]
#[group(id = "Server")]
pub struct ServerOptions {
    /// Address and port the server will bind to.
    #[arg(long = "listen-addr")]
    #[arg(default_value = DEFAULT_LISTEN_ADDR)]
    #[arg(env = "LISTEN_ADDR")]
    pub listen_addr: SocketAddr,
    /// Address and port the metrics will bind to.
    #[arg(long = "metrics-addr")]
    #[arg(default_value = DEFAULT_METRICS_ADDR)]
    #[arg(env = "METRICS_ADDR")]
    pub metrics_addr: SocketAddr,
}

// `Options` is a structup definition to provide clean command-line args for Hermes.
#[derive(Parser, Debug, Clone)]
#[command(name = crate_name!())]
#[command(author = crate_authors!())]
#[command(about = crate_description!())]
#[command(version = crate_version!())]
#[allow(clippy::large_enum_variant)]
pub struct RunOptions {
    #[command(flatten)]
    pub server: ServerOptions,

    /// The URL of the Pythnet node to connect to.
    #[arg(long = "pythnet-url")]
    #[arg(env = "PYTHNET_URL")]
    #[arg(default_value = "https://api2.pythnet.pyth.network")]
    pub pythnet_url: Url,
    /// The Wormhole pid on the Pythnet chain.
    #[arg(long = "wormhole-pid")]
    #[arg(env = "WORMHOLE_PID")]
    pub wormhole_pid: Pubkey,
    /// The index of the guardian set to use.
    #[arg(long = "guardian-set-index")]
    #[arg(env = "GUARDIAN_SET_INDEX")]
    pub guardian_set_index: u32,
    /// The maximum lifetime of an observation in seconds.
    #[arg(long = "observation-lifetime")]
    #[arg(env = "OBSERVATION_LIFETIME")]
    #[arg(default_value_t = DEFAULT_OBSERVATION_LIFETIME)]
    pub observation_lifetime: u32,
}

lazy_static! {
    /// A static exit flag to indicate to running threads that we're shutting down. This is used to
    /// gracefully shut down the application.
    ///
    /// We make this global based on the fact the:
    /// - The `Sender` side does not rely on any async runtime.
    /// - Exit logic doesn't really require carefully threading this value through the app.
    /// - The `Receiver` side of a watch channel performs the detection based on if the change
    ///   happened after the subscribe, so it means all listeners should always be notified
    ///   correctly.

    static ref EXIT: watch::Sender<bool> = watch::channel(false).0;
}

pub async fn wait_for_exit() {
    let mut rx = EXIT.subscribe();
    // Check if the exit flag is already set, if so, we don't need to wait.
    if !(*rx.borrow()) {
        // Wait until the exit flag is set.
        let _ = rx.changed().await;
    }
}

#[derive(Clone)]
pub struct State(Arc<StateInner>);

pub struct StateInner {
    pub verification: Arc<RwLock<HashMap<Vec<u8>, Vec<Signature>>>>,

    pub guardian_set: GuardianSetInfo,
    pub guardian_set_index: u32,

    pub observation_lifetime: u32,

    pub ws: WsState,

    pub metrics_recorder: PrometheusHandle,
}
impl Deref for State {
    type Target = Arc<StateInner>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

const DEFAULT_OBSERVATION_LIFETIME: u32 = 10; // In seconds
const WEBSOCKET_NOTIFICATION_CHANNEL_SIZE: usize = 1000;

async fn fault_tolerant_handler<F, Fut>(name: String, f: F)
where
    F: Fn() -> Fut,
    Fut: Future<Output = anyhow::Result<()>> + Send + 'static,
    Fut::Output: Send + 'static,
{
    loop {
        let res = tokio::spawn(f()).await;
        match res {
            Ok(result) => match result {
                Ok(_) => break, // This will happen on graceful shutdown
                Err(err) => {
                    tracing::error!("{} returned error: {:?}", name, err);
                    sleep(Duration::from_millis(500)).await;
                }
            },
            Err(err) => {
                tracing::error!("{} is panicked or canceled: {:?}", name, err);
                EXIT.send_modify(|exit| *exit = true);
                break;
            }
        }
    }
}

pub async fn run(run_options: RunOptions) -> anyhow::Result<()> {
    // Listen for Ctrl+C so we can set the exit flag and wait for a graceful shutdown.
    tokio::spawn(async move {
        tracing::info!("Registered shutdown signal handler...");
        tokio::signal::ctrl_c().await.unwrap();
        tracing::info!("Shut down signal received, waiting for tasks...");
        EXIT.send_modify(|exit| *exit = true);
    });

    let guardian_set = fetch_guardian_set(
        run_options.pythnet_url.clone(),
        run_options.wormhole_pid,
        run_options.guardian_set_index,
    )
    .await?;

    let state = State(Arc::new(StateInner {
        verification: Arc::new(RwLock::new(HashMap::new())),

        guardian_set,
        guardian_set_index: run_options.guardian_set_index,

        observation_lifetime: run_options.observation_lifetime,

        ws: WsState::new(WEBSOCKET_NOTIFICATION_CHANNEL_SIZE),

        metrics_recorder: setup_metrics_recorder()?,
    }));

    tokio::join!(
        fault_tolerant_handler("API server".to_string(), || api::run(
            run_options.server.listen_addr,
            state.clone()
        )),
        fault_tolerant_handler("metrics server".to_string(), || metrics_server::run(
            run_options.clone(),
            state.clone()
        )),
        metric_collector("state".to_string(), || {
            let state = state.clone();
            async move {
                let verification = state.verification.read().await;
                metrics::gauge!("pending_vaas").set(verification.len() as f64);
                metrics::gauge!("pending_verified_observations")
                    .set(verification.values().flatten().count() as f64);
            }
        }),
    );

    Ok(())
}

#[cfg(test)]
pub mod tests {
    use axum_prometheus::metrics_exporter_prometheus::PrometheusBuilder;

    use super::*;

    pub fn get_state(
        verification: Arc<RwLock<HashMap<Vec<u8>, Vec<Signature>>>>,
        guardian_set: GuardianSetInfo,
        observation_lifetime: u32,
    ) -> State {
        State(Arc::new(StateInner {
            verification,
            guardian_set,
            observation_lifetime,

            guardian_set_index: 0,

            ws: WsState::new(1),

            metrics_recorder: PrometheusBuilder::new().build_recorder().handle(),
        }))
    }
}
