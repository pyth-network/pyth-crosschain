use std::sync::Arc;
use std::time::Duration;
use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::watch;
use tokio::time;
use tracing;

use crate::adapters::contract::GetChainPrices;
use crate::services::{Service, ChainPriceAware};
use crate::state::traits::{ReadChainPriceState, WriteChainPriceState};

pub struct ChainPriceService {
    name: String,
    chain_id: String,
    contract: Arc<dyn GetChainPrices + Send + Sync>,
    poll_interval: Duration,
}

impl ChainPriceService {
    pub fn new(
        chain_id: String,
        contract: Arc<dyn GetChainPrices + Send + Sync>,
        poll_interval: Duration,
    ) -> Self {
        Self {
            name: format!("ChainPriceService-{}", chain_id),
            chain_id: chain_id.clone(),
            contract,
            poll_interval,
        }
    }
    
    async fn poll_prices(&self, chain_price_reader: Arc<dyn ReadChainPriceState>) {
        let feed_ids = chain_price_reader.get_feed_ids();
        
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
    
    async fn start(&self, stop_rx: watch::Receiver<bool>) -> Result<()> {
        tracing::error!(
            service = self.name,
            "ChainPriceService must be started with chain price state access"
        );
        Err(anyhow::anyhow!("ChainPriceService requires chain price state access"))
    }
}

#[async_trait]
impl ChainPriceAware for ChainPriceService {
    async fn start_with_chain_price(
        &self,
        chain_price_reader: Arc<dyn ReadChainPriceState>,
        chain_price_writer: Arc<dyn WriteChainPriceState>,
        mut stop_rx: watch::Receiver<bool>
    ) -> Result<()> {
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
                    self.poll_prices(chain_price_reader.clone()).await;
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
