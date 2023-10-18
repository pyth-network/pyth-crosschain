#![allow(clippy::just_underscores_and_digits)]
#![feature(slice_flatten)]

use {
    anyhow::Result,
    clap::Parser,
    std::error::Error,
};

pub mod api;
pub mod command;
pub mod config;
pub mod ethereum;
pub mod state;

// Server TODO list:
// - Tests
// - Metrics / liveness / readiness endpoints
// - replace println! with proper logging
// - Reduce memory requirements for storing hash chains to increase scalability
// - Name things nicely (service name, API resource names)
// - README
// - use anyhow::Result
#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    match config::Options::parse() {
        config::Options::GetRequest(opts) => command::get_request(&opts).await,
        config::Options::Generate(opts) => command::generate(&opts).await,
        config::Options::Run(opts) => command::run(&opts).await,
        config::Options::RegisterProvider(opts) => command::register_provider(&opts).await,
        config::Options::RequestRandomness(opts) => command::request_randomness(&opts).await,
    }
}
