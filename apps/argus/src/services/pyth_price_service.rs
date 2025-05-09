use std::sync::Arc;
use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::watch;
use tracing;

use crate::adapters::types::ReadPythPrices;
use crate::services::{Service, PythPriceAware};
use crate::state::traits::{ReadPythPriceState, WritePythPriceState};

pub struct PythPriceService {
    name: String,
    pyth_price_client: Arc<dyn ReadPythPrices + Send + Sync>,
}

impl PythPriceService {
    pub fn new(
        chain_id: String,
        pyth_price_client: Arc<dyn ReadPythPrices + Send + Sync>,
    ) -> Self {
        Self {
            name: format!("PythPriceService-{}", chain_id),
            pyth_price_client,
        }
    }
}

#[async_trait]
impl Service for PythPriceService {
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn start(&self, stop_rx: watch::Receiver<bool>) -> Result<()> {
        tracing::error!(
            service = self.name,
            "PythPriceService must be started with Pyth price state access"
        );
        Err(anyhow::anyhow!("PythPriceService requires Pyth price state access"))
    }
}

#[async_trait]
impl PythPriceAware for PythPriceService {
    async fn start_with_pyth_price(
        &self,
        pyth_price_reader: Arc<dyn ReadPythPriceState>,
        pyth_price_writer: Arc<dyn WritePythPriceState>,
        mut stop_rx: watch::Receiver<bool>
    ) -> Result<()> {
        let mut last_feed_ids = pyth_price_reader.get_feed_ids();
        if !last_feed_ids.is_empty() {
            let feed_ids_vec: Vec<_> = last_feed_ids.iter().cloned().collect();
            if let Err(e) = self.pyth_price_client.subscribe_to_price_updates(&feed_ids_vec).await {
                tracing::error!(
                    service = self.name,
                    error = %e,
                    "Failed to subscribe to Pyth price updates"
                );
            }
        }
        
        loop {
            let current_feed_ids = pyth_price_reader.get_feed_ids();
            if current_feed_ids != last_feed_ids {
                let feed_ids_vec: Vec<_> = current_feed_ids.iter().cloned().collect();
                if !feed_ids_vec.is_empty() {
                    if let Err(e) = self.pyth_price_client.subscribe_to_price_updates(&feed_ids_vec).await {
                        tracing::error!(
                            service = self.name,
                            error = %e,
                            "Failed to update Pyth price subscriptions"
                        );
                    }
                }
                last_feed_ids = current_feed_ids;
            }
            
            if stop_rx.changed().await.is_ok() && *stop_rx.borrow() {
                tracing::info!(
                    service = self.name,
                    "Stopping Pyth price service"
                );
                break;
            }
            
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
        
        Ok(())
    }
}
