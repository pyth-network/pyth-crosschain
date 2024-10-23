use crate::config::Config;
use crate::price_update::PriceUpdate;
use crate::utils::error::BenchmarksKeeperError;
use alloy::providers::{Provider, ProviderBuilder, WsConnect};
use futures_util::StreamExt;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info};

pub struct PriceUpdateService {
    config: Arc<Config>,
    price_update_sender: broadcast::Sender<PriceUpdate>,
}

impl PriceUpdateService {
    pub fn new(config: Arc<Config>) -> Self {
        let (price_update_sender, _) = broadcast::channel(100);
        Self {
            config,
            price_update_sender,
        }
    }

    pub fn subscribe_to_price_updates(&self) -> broadcast::Receiver<PriceUpdate> {
        self.price_update_sender.subscribe()
    }

    pub async fn run(&self) -> Result<(), BenchmarksKeeperError> {
        info!("Starting Price Update Service");

        let ws = WsConnect::new(&self.config.rpc_url);
        let provider = ProviderBuilder::new()
            .on_ws(ws)
            .await
            .map_err(|e| BenchmarksKeeperError::RpcConnectionError(e.to_string()))?;

        let filter = PriceUpdate::filter().address(self.config.contract_address);
        let sub = provider.subscribe_logs(&filter).await?;

        info!("Awaiting PriceUpdate events...");

        let mut stream = sub.into_stream();
        while let Some(log) = stream.next().await {
            match PriceUpdate::decode_log(&log) {
                Ok(price_update) => {
                    info!("Received PriceUpdate: {:?}", price_update);
                    match self.price_update_sender.send(price_update) {
                        Ok(_) => info!("Successfully sent price update"),
                        Err(e) => error!("Error sending price update: {}", e),
                    }
                }
                Err(e) => {
                    error!(
                        "Error decoding log: {}",
                        BenchmarksKeeperError::EventDecodeError(e.to_string())
                    );
                }
            }
        }

        Ok(())
    }
}
