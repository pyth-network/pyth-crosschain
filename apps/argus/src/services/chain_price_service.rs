//! Chain Price Service
//!
//! This service is responsible for keeping the tracked set of price feeds up to date
//! with latest prices from the target blockchain network. It updates the ChainPriceState
//! which is read by the Controller service to compare the latest off-chain price with the
//! on-chain price when deciding whether to update the on-chain price.

use anyhow::Result;
use async_trait::async_trait;
use pyth_sdk::Price;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::time;
use tracing;

use crate::adapters::contract::GetChainPrices;
use crate::adapters::types::PriceId;
use crate::services::Service;
use crate::state::ChainName;
use crate::state::ChainPriceState;
use crate::state::SubscriptionState;

pub struct ChainPriceService {
    chain_name: ChainName,
    name: String,
    contract: Arc<dyn GetChainPrices + Send + Sync>,
    poll_interval: Duration,
    chain_price_state: Arc<ChainPriceState>,
    subscription_state: Arc<SubscriptionState>,
}

impl ChainPriceService {
    pub fn new(
        chain_name: ChainName,
        contract: Arc<dyn GetChainPrices + Send + Sync>,
        poll_interval: Duration,
        chain_price_state: Arc<ChainPriceState>,
        subscription_state: Arc<SubscriptionState>,
    ) -> Self {
        Self {
            chain_name: chain_name.clone(),
            name: format!("ChainPriceService-{}", chain_name),
            contract,
            poll_interval,
            chain_price_state,
            subscription_state,
        }
    }

    async fn poll_prices(&self) -> Result<()> {
        // Get all active subscriptions
        let subscriptions = self.subscription_state.get_subscriptions();

        // For each subscription, query the chain for the price of each feed
        for item in subscriptions.iter() {
            let subscription_id = item.key().clone();
            let subscription_params = item.value().clone();

            // TODO: do this in parallel using tokio tasks?
            let price_ids = subscription_params
                .price_ids
                .into_iter()
                .map(|id| PriceId::new(id))
                .collect::<Vec<PriceId>>();
            let prices = self
                .contract
                .get_prices_for_subscription(subscription_id, &price_ids)
                .await?;
            let prices_map: HashMap<PriceId, Price> =
                price_ids.into_iter().zip(prices.into_iter()).collect();

            // Store the latest price feeds for the subscription
            self.chain_price_state
                .update_prices(subscription_id, prices_map);
        }
        Ok(())
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
                    self.poll_prices().await;
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
