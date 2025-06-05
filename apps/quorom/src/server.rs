
use std::{collections::HashMap, net::SocketAddr, ops::Deref, sync::Arc};
use lazy_static::lazy_static;
use tokio::sync::{watch, RwLock};
use tokio_util::task::TaskTracker;
use clap::{
    crate_authors,
    crate_description,
    crate_name,
    crate_version,
    Args,
    Parser,
};
use wormhole_sdk::{vaa::{Body, Signature}, GuardianSetInfo};

use crate::{api::{self}, pythnet::fetch_guardian_set, ws::WsState};

const DEFAULT_LISTEN_ADDR: &str = "127.0.0.1:9000";

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Server Options")]
#[group(id = "Server")]
pub struct ServerOptions {
    /// Address and port the server will bind to.
    #[arg(long = "listen-addr")]
    #[arg(default_value = DEFAULT_LISTEN_ADDR)]
    #[arg(env = "LISTEN_ADDR")]
    pub listen_addr:              SocketAddr,
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
    pub pythnet_url: String,
    /// The Wormhole pid on the Pythnet chain.
    #[arg(long = "wormhole-pid")]
    #[arg(env = "WORMHOLE_PID")]
    pub wormhole_pid: String,
    /// The index of the guardian set to use.
    #[arg(long = "guardian-set-index")]
    #[arg(env = "GUARDIAN_SET_INDEX")]
    pub guardian_set_index: u32,
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
    pub static ref EXIT: watch::Sender<bool> = watch::channel(false).0;
}

#[derive(Clone)]
pub struct State(Arc<StateInner>);
pub struct StateInner {
    pub task_tracker: TaskTracker,
    pub verification: Arc<RwLock<HashMap<Body<Vec<u8>>, Vec<Signature>>>>,

    pub guardian_set:       GuardianSetInfo,
    pub guardian_set_index: u32,

    pub ws: WsState,
}
impl Deref for State {
    type Target = Arc<StateInner>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

const WEBSOCKET_NOTIFICATION_CHANNEL_SIZE: usize = 1000;

pub async fn run(run_options: RunOptions) -> anyhow::Result<()> {
    // Listen for Ctrl+C so we can set the exit flag and wait for a graceful shutdown.
    tokio::spawn(async move {
        tracing::info!("Registered shutdown signal handler...");
        tokio::signal::ctrl_c().await.unwrap();
        tracing::info!("Shut down signal received, waiting for tasks...");
        let _ = EXIT.send(true);
    });

    let task_tracker = TaskTracker::new();
    let guardian_set = fetch_guardian_set(
        run_options.pythnet_url,
        run_options.wormhole_pid.parse()?,
        run_options.guardian_set_index,
    ).await?;

    let state = State(Arc::new(StateInner {
        task_tracker: task_tracker.clone(),
        verification: Arc::new(RwLock::new(HashMap::new())),

        guardian_set,
        guardian_set_index: run_options.guardian_set_index,

        ws: WsState::new(WEBSOCKET_NOTIFICATION_CHANNEL_SIZE),
    }));

    tokio::join!(
        async {
            if let Err(e) = api::run(run_options.server.listen_addr, state).await {
                tracing::error!(error = ?e, "Failed to start API server");
            }
        }
    );

    // To make sure all the spawned tasks will finish their job before shut down
    // Closing task tracker doesn't mean that it won't accept new tasks!!
    task_tracker.close();
    task_tracker.wait().await;

    Ok(())
}
