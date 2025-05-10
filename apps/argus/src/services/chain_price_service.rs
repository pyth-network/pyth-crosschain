use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::time;
use tracing;

use crate::adapters::contract::GetChainPrices;
use crate::services::Service;
use crate::state::ChainPriceState;

pub struct ChainPriceService {
    name: String,
    contract: Arc<dyn GetChainPrices + Send + Sync>,
    poll_interval: Duration,
    chain_price_state: Arc<ChainPriceState>,
}

impl ChainPriceService {
    pub fn new(
        chain_id: String,
        contract: Arc<dyn GetChainPrices + Send + Sync>,
        poll_interval: Duration,
        chain_price_state: Arc<ChainPriceState>,
    ) -> Self {
        Self {
            name: format!("ChainPriceService-{}", chain_id),
            contract,
            poll_interval,
            chain_price_state,
        }
    }

    async fn poll_prices(&self, state: Arc<ChainPriceState>) {
        let feed_ids = state.get_feed_ids();

        tracing::debug!(
            service = self.name,
            feed_count = feed_ids.len(),
            "Polled for on-chain price updates"
        );
    }
}

#[async_trait]
impl Service for ChainPriceService {
    fn name(&self) -> &str {
        &self.name
    }

    async fn start(&self, mut stop_rx: watch::Receiver<bool>) -> Result<()> {
        if let Err(e) = self.contract.subscribe_to_price_events().await {
            tracing::error!(
                service = self.name,
                error = %e,
                "Failed to subscribe to price events"
            );
        }

        let mut interval = time::interval(self.poll_interval);
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    self.poll_prices(self.chain_price_state.clone()).await;
                }
                _ = stop_rx.changed() => {
                    if *stop_rx.borrow() {
                        tracing::info!(
                            service = self.name,
                            "Stopping chain price service"
                        );
                        break;
                    }
                }
            }
        }

        Ok(())
    }
}
