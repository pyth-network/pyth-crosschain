#![feature(never_type)]
#![feature(slice_group_by)]

use {
    crate::store::Store,
    anyhow::Result,
    structopt::StructOpt,
};

mod api;
mod config;
mod macros;
mod network;
mod store;

/// Initialize the Application. This can be invoked either by real main, or by the Geyser plugin.
async fn init() -> Result<()> {
    log::info!("Initializing Hermes...");

    // Parse the command line arguments with StructOpt, will exit automatically on `--help` or
    // with invalid arguments.
    match config::Options::from_args() {
        config::Options::Run {
            pythnet_ws_endpoint,
            pythnet_http_endpoint,
            wh_network_id,
            wh_bootstrap_addrs,
            wh_listen_addrs,
            wh_contract_addr,
            api_addr,
        } => {
            // A channel to emit state updates to api
            let (update_tx, update_rx) = tokio::sync::mpsc::channel(1000);

            log::info!("Running Hermes...");
            let store = Store::new_with_local_cache(update_tx, 1000);

            // Spawn the P2P layer.
            log::info!("Starting P2P server on {:?}", wh_listen_addrs);
            network::p2p::spawn(
                store.clone(),
                wh_network_id.to_string(),
                wh_bootstrap_addrs,
                wh_listen_addrs,
            )
            .await?;

            // Spawn the Pythnet listener
            log::info!("Starting Pythnet listener using {}", pythnet_ws_endpoint);
            // network::pythnet::spawn(
            //     store.clone(),
            //     pythnet_ws_endpoint,
            //     pythnet_http_endpoint,
            //     wh_contract_addr,
            // )
            // .await?;

            // Run the RPC server and wait for it to shutdown gracefully.
            log::info!("Starting RPC server on {}", api_addr);
            api::run(store.clone(), update_rx, api_addr.to_string()).await?;
        }
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<!> {
    env_logger::init();

    tokio::spawn(async move {
        // Launch the application. If it fails, print the full backtrace and exit. RUST_BACKTRACE
        // should be set to 1 for this otherwise it will only print the top-level error.
        if let Err(result) = init().await {
            eprintln!("{}", result.backtrace());
            for cause in result.chain() {
                eprintln!("{cause}");
            }
            std::process::exit(1);
        }
    });

    // TODO: Setup a Ctrl-C handler that waits. We use process::exit(0) for now but we should have
    // a graceful shutdown with an AtomicBool or similar before production.
    tokio::signal::ctrl_c().await?;
    std::process::exit(0);
}
