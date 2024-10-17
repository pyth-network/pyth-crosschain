pub mod config;
mod price_update;
mod utils;

use alloy::providers::{Provider, ProviderBuilder, WsConnect};
use futures_util::StreamExt;
use tracing::info;

use crate::config::Config;
use crate::price_update::PriceUpdate;
use crate::utils::error::BenchmarksKeeperError;

pub async fn run(config: Config) -> Result<(), BenchmarksKeeperError> {
    info!("Starting Benchmarks Keeper");

    // Create the WebSocket connection
    let ws = WsConnect::new(&config.rpc_url);
    let provider = ProviderBuilder::new()
        .on_ws(ws)
        .await
        .map_err(|e| BenchmarksKeeperError::RpcConnectionError(e.to_string()))?;

    // Subscribe to PriceUpdate events
    let filter = PriceUpdate::filter();
    let sub = provider.subscribe_logs(&filter).await?;

    println!("Awaiting PriceUpdate events...");

    // Process PriceUpdate events
    let mut stream = sub.into_stream().take(4);
    while let Some(log) = stream.next().await {
        match PriceUpdate::decode_log(&log) {
            Ok(price_update) => {
                println!("Received PriceUpdate:");
                println!("  Publish Time: {}", price_update.publish_time);
                println!("  Number of Price IDs: {}", price_update.price_ids.len());
                println!("  Metadata length: {} bytes", price_update.metadata.len());
                // TODO: Process the price update
            }
            Err(e) => {
                eprintln!(
                    "Error decoding log: {}",
                    BenchmarksKeeperError::EventDecodeError(e.to_string())
                );
            }
        }
    }

    Ok(())
}
