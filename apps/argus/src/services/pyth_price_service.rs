//! Pyth Price Service
//!
//! This service is responsible for keeping the tracked set of price feeds up to date
//! with latest prices from the Pyth Network. It updates the PythPriceState, which is read
//! by the Controller service to compare the latest off-chain price with the on-chain price
//! when deciding whether to update the on-chain price.

use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tracing;

use crate::adapters::hermes::ReadPythPrices;
use crate::services::Service;
use crate::state::ChainName;

pub struct PythPriceService {
    chain_name: ChainName,
    name: String,
    pyth_price_client: Arc<dyn ReadPythPrices + Send + Sync>,
    pyth_price_state: Arc<crate::state::PythPriceState>,
    poll_interval: Duration,
}

impl PythPriceService {
    pub fn new(
        chain_name: ChainName,
        poll_interval: Duration,
        pyth_price_client: Arc<dyn ReadPythPrices + Send + Sync>,
        pyth_price_state: Arc<crate::state::PythPriceState>,
    ) -> Self {
        Self {
            chain_name: chain_name.clone(),
            name: format!("PythPriceService-{}", chain_name),
            poll_interval,
            pyth_price_client,
            pyth_price_state,
        }
    }
}

#[async_trait]
impl Service for PythPriceService {
    fn name(&self) -> &str {
        &self.name
    }

    async fn start(&self, mut exit_rx: watch::Receiver<bool>) -> Result<()> {
        let mut interval_timer = tokio::time::interval(self.poll_interval);

        loop {
            tokio::select! {
                _ = interval_timer.tick() => {
                    let feed_ids = self.pyth_price_state.get_feed_ids();
                    if !feed_ids.is_empty() {
                        let feed_ids_vec: Vec<_> = feed_ids.iter().cloned().collect();
                        match self.pyth_price_client.get_latest_prices(&feed_ids_vec).await {
                            Ok(_prices_data) => {
                                tracing::debug!(
                                    service = self.name,
                                    feed_count = feed_ids_vec.len(),
                                    "Successfully polled Pyth prices"
                                );
                                // TODO: update the prices in the state
                                // self.pyth_price_state.update_prices(prices_data);

                            }
                            Err(e) => {
                                tracing::error!(
                                    service = self.name,
                                    error = %e,
                                    "Failed to poll Pyth prices"
                                );
                            }
                        }
                    }
                }
                _ = exit_rx.changed() => {
                    if *exit_rx.borrow() {
                        tracing::info!(service = self.name, "Stopping Pyth price service");
                        break;
                    }
                }
            }
        }

        Ok(())
    }
}
