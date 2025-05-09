use std::sync::{Arc, Mutex};
use anyhow::Result;
use async_trait::async_trait;
use backoff::ExponentialBackoff;
use tokio::sync::{mpsc, watch};
use tracing;

use crate::adapters::types::{ReadPythPrices, UpdateChainPrices};
use crate::services::types::PushRequest;
use crate::state::ArgusState;
use crate::services::Service;

pub struct PricePusherService {
    name: String,
    contract: Arc<dyn UpdateChainPrices + Send + Sync>,
    pyth_price_client: Arc<dyn ReadPythPrices + Send + Sync>,
    backoff_policy: ExponentialBackoff,
    request_rx: Mutex<Option<mpsc::Receiver<PushRequest>>>,
    request_tx: mpsc::Sender<PushRequest>,
}

impl PricePusherService {
    pub fn new(
        chain_id: String,
        contract: Arc<dyn UpdateChainPrices + Send + Sync>,
        pyth_price_client: Arc<dyn ReadPythPrices + Send + Sync>,
        backoff_policy: ExponentialBackoff,
    ) -> Self {
        let (request_tx, request_rx) = mpsc::channel(100);
        
        Self {
            name: format!("PricePusherService-{}", chain_id),
            contract,
            pyth_price_client,
            backoff_policy,
            request_rx: Mutex::new(Some(request_rx)),
            request_tx,
        }
    }
    
    pub fn request_sender(&self) -> mpsc::Sender<PushRequest> {
        self.request_tx.clone()
    }
    
    async fn handle_request(&self, request: PushRequest) {
        let price_ids = request.price_ids.clone();
        
        match self.pyth_price_client.get_latest_prices(&price_ids).await {
            Ok(update_data) => {
                match self.contract.update_price_feeds(
                    request.subscription_id,
                    &price_ids,
                    &update_data,
                ).await {
                    Ok(tx_hash) => {
                        tracing::info!(
                            service = self.name,
                            subscription_id = request.subscription_id.to_string(),
                            tx_hash = tx_hash.to_string(),
                            "Successfully pushed price updates"
                        );
                    }
                    Err(e) => {
                        tracing::error!(
                            service = self.name,
                            subscription_id = request.subscription_id.to_string(),
                            error = %e,
                            "Failed to push price updates"
                        );
                    }
                }
            }
            Err(e) => {
                tracing::error!(
                    service = self.name,
                    subscription_id = request.subscription_id.to_string(),
                    error = %e,
                    "Failed to get Pyth price update data"
                );
            }
        }
    }
}

#[async_trait]
impl Service for PricePusherService {
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn start(&self, _state: Arc<ArgusState>, mut stop_rx: watch::Receiver<bool>) -> Result<()> {
        let mut receiver = self.request_rx.lock().expect("Mutex poisoned")
            .take()
            .expect("Request receiver already taken");
        
        loop {
            tokio::select! {
                Some(request) = receiver.recv() => {
                    self.handle_request(request).await;
                }
                _ = stop_rx.changed() => {
                    if *stop_rx.borrow() {
                        tracing::info!(
                            service = self.name,
                            "Stopping price pusher service"
                        );
                        break;
                    }
                }
            }
        }
        
        Ok(())
    }
}
