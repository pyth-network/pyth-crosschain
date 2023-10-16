#![allow(clippy::just_underscores_and_digits)]
#![feature(slice_flatten)]

use std::error::Error;

use clap::Parser;

use {
    anyhow::Result,
    utoipa::OpenApi,
};

use crate::state::PebbleHashChain;

pub mod api;
pub mod config;
pub mod command;
pub mod ethereum;
pub mod state;

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
