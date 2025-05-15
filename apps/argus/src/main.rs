#![allow(clippy::just_underscores_and_digits)]
pub mod adapters;
pub mod api;
pub mod command;
pub mod config;
pub mod metrics;
pub mod services;
pub mod state;

use {anyhow::Result, clap::Parser, std::io::IsTerminal};

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

    match config::Options::parse() {
        config::Options::Run(opts) => command::run(&opts).await,
    }
}
