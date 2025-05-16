//! Controller Service
//!
//! This service orchestrates the price update process for a given blockchain network.
//! It reads from the SubscriptionState, PythPriceState, and ChainPriceState to determine
//! whether to update the on-chain price for a given subscription. It also triggers the
//! PricePusherService to push the update to the target blockchain network.

use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::time;
use tracing;

use crate::adapters::types::{PriceId, SubscriptionId};
use crate::services::types::PushRequest;
use crate::services::Service;
use crate::state::ChainName;
use crate::state::{ChainPriceState, PythPriceState, SubscriptionState};

pub struct ControllerService {
    name: String,
    update_interval: Duration,
    subscription_state: Arc<SubscriptionState>,
    pyth_price_state: Arc<PythPriceState>,
    chain_price_state: Arc<ChainPriceState>,
}

impl ControllerService {
    pub fn new(
        chain_name: ChainName,
        update_interval: Duration,
        subscription_state: Arc<SubscriptionState>,
        pyth_price_state: Arc<PythPriceState>,
        chain_price_state: Arc<ChainPriceState>,
    ) -> Self {
        Self {
            name: format!("ControllerService-{}", chain_name),
            update_interval,
            subscription_state,
            pyth_price_state,
            chain_price_state,
        }
    }

    async fn perform_update(&self) {
        let subscriptions = self.subscription_state.get_subscriptions();

        tracing::debug!(
            service = self.name,
            subscription_count = subscriptions.len(),
            "Checking subscriptions for updates"
        );

        for (sub_id, params) in subscriptions {
            let mut _needs_update = false;
            let mut feed_ids: Vec<PriceId> = Vec::new();

            for feed_id in &params.price_ids {
                let feed_id = PriceId::new(*feed_id);
                let pyth_price = self.pyth_price_state.get_price(&feed_id);
                let chain_price = self.chain_price_state.get_price(&feed_id);

                if pyth_price.is_none() || chain_price.is_none() {
                    continue;
                }

                feed_ids.push(feed_id);
            }

            if _needs_update && !feed_ids.is_empty() {
                self.trigger_update(sub_id, feed_ids).await;
            }
        }
    }

    async fn trigger_update(&self, subscription_id: SubscriptionId, price_ids: Vec<PriceId>) {
        tracing::info!(
            service = self.name,
            subscription_id = subscription_id.to_string(),
            feed_count = price_ids.len(),
            "Triggering price update"
        );

        let _request = PushRequest {
            subscription_id,
            price_ids,
        };

        tracing::debug!(
            service = self.name,
            "Would push update for subscription {}",
            subscription_id
        );
    }
}

#[async_trait]
impl Service for ControllerService {
    fn name(&self) -> &str {
        &self.name
    }

    async fn start(&self, mut stop_rx: watch::Receiver<bool>) -> Result<()> {
        let mut interval = time::interval(self.update_interval);

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    self.perform_update().await;
                }
                _ = stop_rx.changed() => {
                    if *stop_rx.borrow() {
                        tracing::info!(
                            service = self.name,
                            "Stopping controller service"
                        );
                        break;
                    }
                }
            }
        }

        Ok(())
    }
}
