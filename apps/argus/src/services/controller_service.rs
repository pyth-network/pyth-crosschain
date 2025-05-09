use std::sync::Arc;
use std::time::Duration;
use std::collections::HashSet;
use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::{mpsc, watch};
use tokio::time;
use tracing;

use crate::adapters::types::{PriceId, SubscriptionId, Price};
use crate::services::{Service, SubscriptionAware};
use crate::services::types::PushRequest;
use crate::state::traits::{
    ReadSubscriptionState, WriteSubscriptionState,
    ReadPythPriceState, WritePythPriceState,
    ReadChainPriceState, WriteChainPriceState
};

struct PythPriceReaderAdapter(Arc<dyn ReadSubscriptionState>);
struct ChainPriceReaderAdapter(Arc<dyn ReadSubscriptionState>);

impl ReadPythPriceState for PythPriceReaderAdapter {
    fn get_price(&self, feed_id: &PriceId) -> Option<Price> {
        None // Placeholder implementation
    }
    
    fn get_feed_ids(&self) -> HashSet<PriceId> {
        self.0.get_feed_ids()
    }
}

impl ReadChainPriceState for ChainPriceReaderAdapter {
    fn get_price(&self, feed_id: &PriceId) -> Option<Price> {
        None // Placeholder implementation
    }
    
    fn get_feed_ids(&self) -> HashSet<PriceId> {
        self.0.get_feed_ids()
    }
}

pub struct ControllerService {
    name: String,
    chain_id: String,
    update_interval: Duration,
    price_pusher_tx: Option<mpsc::Sender<PushRequest>>,
}

impl ControllerService {
    pub fn new(
        chain_id: String,
        update_interval: Duration,
    ) -> Self {
        Self {
            name: format!("ControllerService-{}", chain_id),
            chain_id: chain_id.clone(),
            update_interval,
            price_pusher_tx: None,
        }
    }
    
    pub fn set_price_pusher_tx(&mut self, tx: mpsc::Sender<PushRequest>) {
        self.price_pusher_tx = Some(tx);
    }
    
    async fn perform_update(
        &self,
        subscription_reader: Arc<dyn ReadSubscriptionState>,
        pyth_price_reader: Arc<dyn ReadPythPriceState>,
        chain_price_reader: Arc<dyn ReadChainPriceState>
    ) {
        let subscriptions = subscription_reader.get_subscriptions();
        
        tracing::debug!(
            service = self.name,
            subscription_count = subscriptions.len(),
            "Checking subscriptions for updates"
        );
        
        for (sub_id, params) in subscriptions {
            let mut needs_update = false;
            let mut feed_ids = Vec::new();
            
            for feed_id in &params.price_feed_ids {
                let pyth_price = pyth_price_reader.get_price(feed_id);
                let chain_price = chain_price_reader.get_price(feed_id);
                
                if pyth_price.is_none() || chain_price.is_none() {
                    continue;
                }
                
                
                feed_ids.push(*feed_id);
            }
            
            if needs_update && !feed_ids.is_empty() {
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
        
        let request = PushRequest {
            subscription_id,
            price_ids,
        };
        
        if let Some(tx) = &self.price_pusher_tx {
            if let Err(e) = tx.send(request).await {
                tracing::error!(
                    service = self.name,
                    error = %e,
                    "Failed to send price update request"
                );
            }
        } else {
            tracing::debug!(
                service = self.name,
                "Would push update for subscription {}",
                subscription_id
            );
        }
    }
}

#[async_trait]
impl Service for ControllerService {
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn start(&self, stop_rx: watch::Receiver<bool>) -> Result<()> {
        tracing::error!(
            service = self.name,
            "ControllerService must be started with subscription state access"
        );
        Err(anyhow::anyhow!("ControllerService requires subscription state access"))
    }
}

#[async_trait]
impl SubscriptionAware for ControllerService {
    async fn start_with_subscription(
        &self,
        subscription_reader: Arc<dyn ReadSubscriptionState>,
        _subscription_writer: Arc<dyn WriteSubscriptionState>,
        _pyth_price_writer: Arc<dyn WritePythPriceState>,
        _chain_price_writer: Arc<dyn WriteChainPriceState>,
        mut stop_rx: watch::Receiver<bool>
    ) -> Result<()> {
        let pyth_price_reader = Arc::new(PythPriceReaderAdapter(subscription_reader.clone()));
        let chain_price_reader = Arc::new(ChainPriceReaderAdapter(subscription_reader.clone()));
        
        let mut interval = time::interval(self.update_interval);
        
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    self.perform_update(
                        subscription_reader.clone(),
                        pyth_price_reader.clone(),
                        chain_price_reader.clone()
                    ).await;
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
