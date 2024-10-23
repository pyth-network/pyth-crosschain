pub mod api;
pub mod config;
pub mod price_update;
pub mod price_update_service;
pub mod types;
pub mod utils;

use crate::config::Config;
use crate::price_update_service::PriceUpdateService;
use crate::utils::error::BenchmarksKeeperError;
use std::sync::Arc;
use tokio::spawn;
use tokio::time;
use tracing::info;

pub async fn run(config: Arc<Config>) -> Result<(), BenchmarksKeeperError> {
    info!("Starting Benchmarks Keeper");

    let price_update_service = PriceUpdateService::new(config.clone());

    // Run the price update service in a separate task
    spawn(async move {
        if let Err(e) = price_update_service.run().await {
            eprintln!("Price Update Service error: {:?}", e);
        }
    });

    // Here you can add more logic for handling the received price updates
    // For example, you could process them or send them to clients

    // Keep the main task running
    loop {
        time::sleep(std::time::Duration::from_secs(1)).await;
    }
}
