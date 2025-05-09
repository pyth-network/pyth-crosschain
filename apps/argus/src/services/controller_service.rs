use std::sync::Arc;
use std::time::Duration;
use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::watch;
use tokio::time;
use tracing;

use crate::adapters::types::{PriceId, SubscriptionId};
use crate::services::types::PushRequest;
use crate::state::ArgusState;
use crate::services::Service;

pub struct ControllerService {
    name: String,
    update_interval: Duration,
}

impl ControllerService {
    pub fn new(
        chain_id: String,
        update_interval: Duration,
    ) -> Self {
        Self {
            name: format!("ControllerService-{}", chain_id),
            update_interval,
        }
    }
    
    async fn perform_update(&self, state: Arc<ArgusState>) {
        let subscriptions = state.subscription_state.get_subscriptions();
        
        tracing::debug!(
            service = self.name,
            subscription_count = subscriptions.len(),
            "Checking subscriptions for updates"
        );
        
        for (sub_id, params) in subscriptions {
            let mut needs_update = false;
            let mut feed_ids = Vec::new();
            
            for feed_id in &params.price_feed_ids {
                let pyth_price = state.pyth_price_state.get_price(feed_id);
                let chain_price = state.chain_price_state.get_price(feed_id);
                
                if pyth_price.is_none() || chain_price.is_none() {
                    continue;
                }
                
                
                feed_ids.push(*feed_id);
            }
            
            if needs_update && !feed_ids.is_empty() {
                self.trigger_update(state.clone(), sub_id, feed_ids).await;
            }
        }
    }
    
    async fn trigger_update(&self, state: Arc<ArgusState>, subscription_id: SubscriptionId, price_ids: Vec<PriceId>) {
        tracing::info!(
            service = self.name,
            subscription_id = subscription_id.to_string(),
            feed_count = price_ids.len(),
            "Triggering price update"
        );
        
        let request = PushRequest {
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
    
    async fn start(&self, state: Arc<ArgusState>, mut stop_rx: watch::Receiver<bool>) -> Result<()> {
        let mut interval = time::interval(self.update_interval);
        
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    self.perform_update(state.clone()).await;
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
