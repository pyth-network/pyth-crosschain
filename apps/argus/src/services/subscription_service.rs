//! Subscription Service
//!
//! This service manages the lifecycle of price feed subscriptions for a specific blockchain network.
//! Users can update their Pulse subscriptions by adding or removing price feeds any time. This service
//! tracks the state of these subscriptions on-chain, and updates the tracked price IDs in the Pyth Price
//! and Chain Price services.

use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio::time;
use tracing;

use crate::adapters::contract::ReadChainSubscriptions;
use crate::services::Service;
use crate::state::ChainName;

pub struct SubscriptionService {
    chain_name: ChainName,
    name: String,
    contract: Arc<dyn ReadChainSubscriptions + Send + Sync>,
    poll_interval: Duration,
    subscription_state: Arc<crate::state::SubscriptionState>,
    pyth_price_state: Arc<crate::state::PythPriceState>,
    chain_price_state: Arc<crate::state::ChainPriceState>,
}

impl SubscriptionService {
    pub fn new(
        chain_name: ChainName,
        contract: Arc<dyn ReadChainSubscriptions + Send + Sync>,
        poll_interval: Duration,
        subscription_state: Arc<crate::state::SubscriptionState>,
        pyth_price_state: Arc<crate::state::PythPriceState>,
        chain_price_state: Arc<crate::state::ChainPriceState>,
    ) -> Self {
        Self {
            chain_name: chain_name.clone(),
            name: format!("SubscriptionService-{}", chain_name),
            contract,
            poll_interval,
            subscription_state,
            pyth_price_state,
            chain_price_state,
        }
    }

    async fn refresh_subscriptions(&self) -> Result<()> {
        match self.contract.get_active_subscriptions().await {
            Ok(subscriptions) => {
                tracing::info!(
                    service_name = self.name,
                    subscription_count = subscriptions.len(),
                    "Retrieved active subscriptions"
                );

                self.subscription_state.update_subscriptions(subscriptions);

                let feed_ids = self.subscription_state.get_feed_ids();
                self.pyth_price_state.update_feed_ids(feed_ids.clone());
                self.chain_price_state.update_feed_ids(feed_ids);

                Ok(())
            }
            Err(e) => {
                tracing::error!(
                    service_name = self.name,
                    error = %e,
                    "Failed to load active subscriptions"
                );
                Err(e)
            }
        }
    }
}

#[async_trait]
impl Service for SubscriptionService {
    fn name(&self) -> &str {
        &self.name
    }
    async fn start(&self, mut exit_rx: watch::Receiver<bool>) -> Result<()> {
        // Initial load of subscriptions
        let _ = self.refresh_subscriptions().await;
        let mut interval = time::interval(self.poll_interval);

        loop {
            tokio::select! {
                // Consume SubscriptionUpdated events
                // Some(event) = event_stream.next() => {
                //     tracing::info!(
                //         service_name = self.name,
                //         subscription_id = ?event.subscription_id,
                //         "Received SubscriptionModified event"
                //     );
                //     // Refresh subscriptions when we get an event
                //     let _ = self.refresh_subscriptions().await;
                // }
                _ = interval.tick() => {
                    // Regular polling as a fallback
                    let _ = self.refresh_subscriptions().await;
                }
                _ = exit_rx.changed() => {
                    if *exit_rx.borrow() {
                        tracing::info!(
                            service = self.name,
                            "Stopping subscription service"
                        );
                        break;
                    }
                }
            }
        }

        Ok(())
    }
}
