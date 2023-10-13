#![allow(clippy::just_underscores_and_digits)]
#![feature(slice_flatten)]

use clap::Parser;
use std::error::Error;

pub mod api;
pub mod config;
pub mod ethereum;
pub mod state;

use ethereum::register_provider;
use ethereum::request_randomness;

use crate::state::PebbleHashChain;

const SECRET: [u8; 32] = [0u8; 32];

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    match config::Options::parse() {
        config::Options::Run(_) => run().await,
        config::Options::RegisterProvider(opts) => register_provider(&opts).await,
        config::Options::RequestRandomness(opts) => request_randomness(&opts).await,
    }
}

async fn run() -> Result<(), Box<dyn Error>> {
    // Try a PebbleChain.
    let mut chain = PebbleHashChain::new(SECRET, 32);
    println!("Next: {:?}", chain.reveal());
    println!("Next: {:?}", chain.reveal());
    println!("Next: {:?}", chain.reveal());

    Ok(())
}
