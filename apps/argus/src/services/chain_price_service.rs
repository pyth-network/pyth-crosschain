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

    #[tracing::instrument(skip_all, fields(task = self.name, chain_name = self.chain_name))]
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

            match self
                .contract
                .get_prices_for_subscription(subscription_id, &price_ids)
                .await
            {
                Ok(prices) => {
                    let prices_map: HashMap<PriceId, Price> = price_ids
                        .clone()
                        .into_iter()
                        .zip(prices.into_iter())
                        .collect();

                    tracing::debug!(
                        price_ids = ?price_ids,
                        subscription_id = %subscription_id,
                        "Got prices for subscription"
                    );

                    // Store the latest price feeds for the subscription
                    self.chain_price_state
                        .update_prices(subscription_id, prices_map);
                }
                Err(e) => {
                    // If we failed to get prices for a subscription, we'll retry on the next poll interval.
                    // Continue to the next subscription.
                    tracing::error!(
                        subscription_id = %subscription_id,
                        error = %e,
                        "Failed to get prices for subscription"
                    );
                    continue;
                }
            }
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
                    if let Err(e) = self.poll_prices().await {
                        tracing::error!(
                            service = self.name,
                            error = %e,
                            "Failed to poll chain prices"
                        );
                    }
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
