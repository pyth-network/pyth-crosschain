#![feature(never_type)]
#![feature(btree_cursors)]

use {
    anyhow::Result,
    clap::{
        CommandFactory,
        Parser,
    },
    futures::future::join_all,
    hermes::{
        api,
        config,
        metrics_server,
        network,
        state,
        EXIT,
    },
    std::io::IsTerminal,
    tokio::spawn,
};

/// Initialize the Application. This can be invoked either by real main, or by the Geyser plugin.
#[tracing::instrument]
async fn init() -> Result<()> {
    tracing::info!("Initializing Hermes...");

    // Parse the command line arguments with StructOpt, will exit automatically on `--help` or
    // with invalid arguments.
    match config::Options::parse() {
        config::Options::Run(opts) => {
            tracing::info!("Starting hermes service...");

            // The update broadcast channel is used to send store update notifications to the public API.
            let (update_tx, _) = tokio::sync::broadcast::channel(1000);

            // Initialize a cache store with a 1000 element circular buffer.
            let state = state::new(
                update_tx.clone(),
                1000,
                opts.benchmarks.endpoint.clone(),
                opts.aggregate.readiness_staleness_threshold.into(),
                opts.aggregate.readiness_max_allowed_slot_lag,
            );

            // Listen for Ctrl+C so we can set the exit flag and wait for a graceful shutdown.
            spawn(async move {
                tracing::info!("Registered shutdown signal handler...");
                tokio::signal::ctrl_c().await.unwrap();
                tracing::info!("Shut down signal received, waiting for tasks...");
                let _ = EXIT.send(true);
            });

            // Spawn all worker tasks, and wait for all to complete (which will happen if a shutdown
            // signal has been observed).
            let tasks = join_all(vec![
                spawn(network::wormhole::spawn(opts.clone(), state.clone())),
                spawn(network::pythnet::spawn(opts.clone(), state.clone())),
                spawn(metrics_server::run(opts.clone(), state.clone())),
                spawn(api::spawn(opts.clone(), state.clone())),
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
    let fmt_builder = tracing_subscriber::fmt()
        .with_file(false)
        .with_line_number(true)
        .with_thread_ids(true)
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_ansi(std::io::stderr().is_terminal());

    // Use the compact formatter if we're in a terminal, otherwise use the JSON formatter.
    if std::io::stderr().is_terminal() {
        tracing::subscriber::set_global_default(fmt_builder.compact().finish())?;
    } else {
        tracing::subscriber::set_global_default(fmt_builder.json().finish())?;
    }

    // Launch the application. If it fails, print the full backtrace and exit. RUST_BACKTRACE
    // should be set to 1 for this otherwise it will only print the top-level error.
    if let Err(result) = init().await {
        eprintln!("{}", result.backtrace());
        result.chain().for_each(|cause| eprintln!("{cause}"));
        std::process::exit(1);
    }

    Ok(())
}
