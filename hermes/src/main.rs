#![feature(never_type)]
#![feature(btree_cursors)]

use {
    anyhow::Result,
    clap::{
        CommandFactory,
        Parser,
    },
    futures::future::join_all,
    state::State,
    std::{
        io::IsTerminal,
        sync::atomic::AtomicBool,
    },
    tokio::spawn,
};

mod aggregate;
mod api;
mod config;
mod metrics_server;
mod network;
mod serde;
mod state;

// A static exit flag to indicate to running threads that we're shutting down. This is used to
// gracefully shutdown the application.
//
// NOTE: A more idiomatic approach would be to use a tokio::sync::broadcast channel, and to send a
// shutdown signal to all running tasks. However, this is a bit more complicated to implement and
// we don't rely on global state for anything else.
pub(crate) static SHOULD_EXIT: AtomicBool = AtomicBool::new(false);

/// Initialize the Application. This can be invoked either by real main, or by the Geyser plugin.
#[tracing::instrument]
async fn init() -> Result<()> {
    tracing::info!("Initializing Hermes...");

    // Parse the command line arguments with StructOpt, will exit automatically on `--help` or
    // with invalid arguments.
    match config::Options::parse() {
        config::Options::Run(opts) => {
            tracing::info!("Starting hermes service...");

            // The update channel is used to send store update notifications to the public API.
            let (update_tx, update_rx) = tokio::sync::mpsc::channel(1000);

            // Initialize a cache store with a 1000 element circular buffer.
            let store = State::new(update_tx.clone(), 1000, opts.benchmarks.endpoint.clone());

            // Listen for Ctrl+C so we can set the exit flag and wait for a graceful shutdown.
            spawn(async move {
                tracing::info!("Registered shutdown signal handler...");
                tokio::signal::ctrl_c().await.unwrap();
                tracing::info!("Shut down signal received, waiting for tasks...");
                SHOULD_EXIT.store(true, std::sync::atomic::Ordering::Release);
            });

            // Spawn all worker tasks, and wait for all to complete (which will happen if a shutdown
            // signal has been observed).
            let tasks = join_all([
                Box::pin(spawn(network::wormhole::spawn(opts.clone(), store.clone()))),
                Box::pin(spawn(network::pythnet::spawn(opts.clone(), store.clone()))),
                Box::pin(spawn(metrics_server::run(opts.clone(), store.clone()))),
                Box::pin(spawn(api::spawn(opts.clone(), store.clone(), update_rx))),
            ])
            .await;

            for task in tasks {
                task??;
            }
        }

        config::Options::ShowEnv(opts) => {
            // For each subcommand, scan for arguments that allow overriding with an ENV variable
            // and print that variable.
            for subcommand in config::Options::command().get_subcommands() {
                for arg in subcommand.get_arguments() {
                    if let Some(env) = arg.get_env().and_then(|env| env.to_str()) {
                        // Find the defaults for this argument, if present.
                        let defaults = arg
                            .get_default_values()
                            .iter()
                            .map(|v| v.to_str().unwrap())
                            .collect::<Vec<_>>()
                            .join(",");

                        println!(
                            "{}={}",
                            env,
                            match opts.defaults {
                                true => defaults,
                                false => std::env::var(env).unwrap_or(defaults),
                            }
                        );
                    }
                }
            }
        }
    }

    Ok(())
}

#[tokio::main]
#[tracing::instrument]
async fn main() -> Result<()> {
    // Initialize a Tracing Subscriber
    tracing::subscriber::set_global_default(
        tracing_subscriber::fmt()
            .compact()
            .with_file(false)
            .with_line_number(true)
            .with_thread_ids(true)
            .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
            .with_ansi(std::io::stderr().is_terminal())
            .finish(),
    )?;

    // Launch the application. If it fails, print the full backtrace and exit. RUST_BACKTRACE
    // should be set to 1 for this otherwise it will only print the top-level error.
    if let Err(result) = init().await {
        eprintln!("{}", result.backtrace());
        result.chain().for_each(|cause| eprintln!("{cause}"));
        std::process::exit(1);
    }

    Ok(())
}
