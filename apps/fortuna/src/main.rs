#![allow(clippy::just_underscores_and_digits)]

use {
    anyhow::Result,
    clap::Parser,
    fortuna::{command, config},
    std::io::IsTerminal,
};

// Server TODO list:
// - Tests
// - Reduce memory requirements for storing hash chains to increase scalability
// - Name things nicely (API resource names)
// - README
// - Choose data formats for binary data
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
    if std::io::stderr().is_terminal() {
        tracing::subscriber::set_global_default(fmt_builder.compact().finish())?;
    } else {
        tracing::subscriber::set_global_default(fmt_builder.json().finish())?;
    }

    match config::Options::parse() {
        config::Options::GetRequest(opts) => command::get_request(&opts).await,
        config::Options::Generate(opts) => command::generate(&opts).await,
        config::Options::Run(opts) => command::run(&opts).await,
        config::Options::RegisterProvider(opts) => command::register_provider(&opts).await,
        config::Options::SetupProvider(opts) => command::setup_provider(&opts).await,
        config::Options::RequestRandomness(opts) => command::request_randomness(&opts).await,
        config::Options::Inspect(opts) => command::inspect(&opts).await,
        config::Options::WithdrawFees(opts) => command::withdraw_fees(&opts).await,
    }
}
