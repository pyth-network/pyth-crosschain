//! Rust consumer SDK for Pyth Lazer.
//!
//! This SDK allows subscribing to Pyth Lazer WebSocket feeds and receiving price updates.

mod client;

pub use client::RedundantLazerClient;
