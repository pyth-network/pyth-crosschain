//! Chain Price Service
//!
//! This service is responsible for keeping the tracked set of price feeds up to date
//! with latest prices from the target blockchain network. It updates the ChainPriceState
//! which is read by the Controller service to compare the latest off-chain price with the
//! on-chain price when deciding whether to update the on-chain price.

use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::time;
use tracing;

use crate::adapters::contract::GetChainPrices;
use crate::services::Service;
use crate::state::ChainName;
use crate::state::ChainPriceState;

pub struct ChainPriceService {
    chain_name: ChainName,
    name: String,
    contract: Arc<dyn GetChainPrices + Send + Sync>,
    poll_interval: Duration,
    chain_price_state: Arc<ChainPriceState>,
}

impl ChainPriceService {
    pub fn new(
        chain_name: ChainName,
        contract: Arc<dyn GetChainPrices + Send + Sync>,
        poll_interval: Duration,
        chain_price_state: Arc<ChainPriceState>,
    ) -> Self {
        Self {
            chain_name: chain_name.clone(),
            name: format!("ChainPriceService-{}", chain_name),
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
