pub mod api;
pub mod config;
pub mod price_update;
pub mod types;
pub mod utils;

use alloy::providers::{Provider, ProviderBuilder, WsConnect};
use api::fetch_price_data;
use futures_util::StreamExt;
use tracing::info;

use crate::config::Config;
use crate::price_update::PriceUpdate;
use crate::utils::error::BenchmarksKeeperError;

pub async fn run(config: Config) -> Result<(), BenchmarksKeeperError> {
    info!("Starting Benchmarks Keeper");

    // Create the WebSocket connection
    let ws = WsConnect::new(&config.rpc_url);
    println!("WebSocket connection created: {:?}", ws);
    let provider = ProviderBuilder::new()
        .on_ws(ws)
        .await
        .map_err(|e| BenchmarksKeeperError::RpcConnectionError(e.to_string()))?;

    // Subscribe to PriceUpdate events
    let filter = PriceUpdate::filter().address(config.contract_address);
    let sub = provider.subscribe_logs(&filter).await?;

    println!("Awaiting PriceUpdate events...");

    let client = reqwest::Client::new();

    // Process PriceUpdate events
    let mut stream = sub.into_stream();
    while let Some(log) = stream.next().await {
        match PriceUpdate::decode_log(&log) {
            Ok(price_update) => {
                println!("Received PriceUpdate:");
                println!("  Publish Time: {}", price_update.publish_time);
                println!("  Number of Price IDs: {}", price_update.price_ids.len());
                println!("  Price IDs: {:?}", price_update.price_ids);
                println!(
                    "  Client Context length: {} bytes",
                    price_update.client_context.len()
                );
                // TODO: Process the price update
                // Call fetch_price_data
                match fetch_price_data(
                    &client,
                    &config.hermes_url,
                    price_update.publish_time,
                    &price_update.price_ids,
                    price_update.client_context,
                )
                .await
                {
                    Ok(price_data) => {
                        println!("Fetched price data: {:?}", price_data);
                        // TODO: Process the fetched price data
                    }
                    Err(e) => {
                        eprintln!("Error fetching price data: {}", e);
                    }
                }
            }
            Err(e) => {
                eprintln!(
                    "Error decoding log: {}",
                    BenchmarksKeeperError::EventDecodeError(e.to_string())
                );
            }
        }
    }
    println!("Stream ended");

    Ok(())
}
