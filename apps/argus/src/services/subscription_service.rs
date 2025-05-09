use std::sync::Arc;
use std::time::Duration;
use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::watch;
use tokio::time;
use tracing;

use crate::adapters::types::ReadChainSubscriptions;
use crate::services::{Service, SubscriptionAware};
use crate::state::traits::{ReadSubscriptionState, WriteSubscriptionState, WritePythPriceState, WriteChainPriceState};

pub struct SubscriptionService {
    name: String,
    chain_id: String,
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
            chain_id: chain_id.clone(),
            contract,
            poll_interval,
        }
    }

    async fn refresh_subscriptions(
        &self,
        subscription_writer: Arc<dyn WriteSubscriptionState>,
        pyth_price_writer: Arc<dyn WritePythPriceState>,
        chain_price_writer: Arc<dyn WriteChainPriceState>
    ) -> Result<()> {
        match self.contract.get_active_subscriptions().await {
            Ok(subscriptions) => {
                tracing::info!(
                    chain_name = self.chain_id,
                    subscription_count = subscriptions.len(),
                    "Retrieved active subscriptions"
                );
                
                subscription_writer.update_subscriptions(subscriptions);
                
                let feed_ids = subscription_writer.get_feed_ids();
                pyth_price_writer.update_feed_ids(feed_ids.clone());
                chain_price_writer.update_feed_ids(feed_ids);
                
                Ok(())
            }
            Err(e) => {
                tracing::error!(
                    chain_name = self.chain_id,
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
    
    async fn start(&self, stop_rx: watch::Receiver<bool>) -> Result<()> {
        tracing::error!(
            service = self.name,
            "SubscriptionService must be started with subscription state access"
        );
        Err(anyhow::anyhow!("SubscriptionService requires subscription state access"))
    }
}

#[async_trait]
impl SubscriptionAware for SubscriptionService {
    async fn start_with_subscription(
        &self,
        subscription_reader: Arc<dyn ReadSubscriptionState>,
        subscription_writer: Arc<dyn WriteSubscriptionState>,
        pyth_price_writer: Arc<dyn WritePythPriceState>,
        chain_price_writer: Arc<dyn WriteChainPriceState>,
        mut stop_rx: watch::Receiver<bool>
    ) -> Result<()> {
        if let Err(e) = self.contract.subscribe_to_subscription_events().await {
            tracing::error!(
                chain_name = self.chain_id,
                error = %e,
                "Failed to subscribe to contract events"
            );
        }
        
        let _ = self.refresh_subscriptions(
            subscription_writer.clone(),
            pyth_price_writer.clone(),
            chain_price_writer.clone()
        ).await;
        
        let mut interval = time::interval(self.poll_interval);
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let _ = self.refresh_subscriptions(
                        subscription_writer.clone(),
                        pyth_price_writer.clone(),
                        chain_price_writer.clone()
                    ).await;
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
