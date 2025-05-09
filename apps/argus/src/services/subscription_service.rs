use std::sync::Arc;
use std::time::Duration;
use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::watch;
use tokio::time;
use tracing;

use crate::adapters::types::ReadChainSubscriptions;
use crate::state::ArgusState;
use crate::services::Service;

pub struct SubscriptionService {
    name: String,
    contract: Arc<dyn ReadChainSubscriptions + Send + Sync>,
    poll_interval: Duration,
}

impl SubscriptionService {
    pub fn new(
        chain_id: String,
        contract: Arc<dyn ReadChainSubscriptions + Send + Sync>,
        poll_interval: Duration,
    ) -> Self {
        Self {
            name: format!("SubscriptionService-{}", chain_id),
            contract,
            poll_interval,
        }
    }

    async fn refresh_subscriptions(&self, state: Arc<ArgusState>) -> Result<()> {
        match self.contract.get_active_subscriptions().await {
            Ok(subscriptions) => {
                tracing::info!(
                    chain_name = state.chain_id,
                    subscription_count = subscriptions.len(),
                    "Retrieved active subscriptions"
                );
                
                state.subscription_state.update_subscriptions(subscriptions);
                
                let feed_ids = state.subscription_state.get_feed_ids();
                state.pyth_price_state.update_feed_ids(feed_ids.clone());
                state.chain_price_state.update_feed_ids(feed_ids);
                
                Ok(())
            }
            Err(e) => {
                tracing::error!(
                    chain_name = state.chain_id,
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
    
    async fn start(&self, state: Arc<ArgusState>, mut stop_rx: watch::Receiver<bool>) -> Result<()> {
        if let Err(e) = self.contract.subscribe_to_subscription_events().await {
            tracing::error!(
                chain_name = state.chain_id,
                error = %e,
                "Failed to subscribe to contract events"
            );
        }
        
        let _ = self.refresh_subscriptions(state.clone()).await;
        
        let mut interval = time::interval(self.poll_interval);
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let _ = self.refresh_subscriptions(state.clone()).await;
                }
                _ = stop_rx.changed() => {
                    if *stop_rx.borrow() {
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
