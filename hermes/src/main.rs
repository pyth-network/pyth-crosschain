#![feature(never_type)]
#![feature(slice_group_by)]
#![feature(btree_cursors)]

use {
    crate::store::Store,
    anyhow::Result,
    structopt::StructOpt,
};

mod api;
mod config;
mod doc_examples;
mod macros;
mod network;
mod store;

/// Initialize the Application. This can be invoked either by real main, or by the Geyser plugin.
async fn init() -> Result<()> {
    log::info!("Initializing Hermes...");

    // Parse the command line arguments with StructOpt, will exit automatically on `--help` or
    // with invalid arguments.
    match config::Options::from_args() {
        config::Options::Run(opts) => {
            log::info!("Starting hermes service...");

            // The update channel is used to send store update notifications to the public API.
            let (update_tx, update_rx) = tokio::sync::mpsc::channel(1000);

            // Initialize a cache store with a 1000 element circular buffer.
            let store = Store::new(update_tx, 1000);

            network::p2p::spawn(opts.clone(), store.clone()).await?;
            network::pythnet::spawn(opts.clone(), store.clone()).await?;
            api::run(opts.clone(), store.clone(), update_rx).await?;
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
