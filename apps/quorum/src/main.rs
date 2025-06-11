use clap::Parser;
use std::io::IsTerminal;

use crate::server::RunOptions;

mod api;
mod pythnet;
mod server;
mod ws;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
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

    server::run(RunOptions::parse()).await
}
