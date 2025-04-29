use {
    crate::{
        chain::ethereum::SignablePythContract,
        config::EthereumConfig,
        metrics::PricePusherMetrics,
        pyth_price_listener::{PythPrice, PythPriceListener},
    },
    anyhow::Result,
    async_trait::async_trait,
    backoff::{backoff::Backoff, ExponentialBackoff},
    ethers::types::{U256, H256},
    std::{sync::Arc, time::Duration},
};

#[derive(Debug, Clone)]
pub struct PriceUpdateRequest {
    pub subscription_id: U256,
    pub price_ids: Vec<[u8; 32]>,
}

#[async_trait]
pub trait PricePusher: Send + Sync {
    async fn initialize(&self) -> Result<()>;

    async fn push_price_updates(&self, request: PriceUpdateRequest) -> Result<H256>;
}

pub struct EthereumPricePusher {
    contract: Arc<SignablePythContract>,
    config: EthereumConfig,
    pyth_price_listener: Arc<dyn PythPriceListener>,
    metrics: Arc<PricePusherMetrics>,
    hermes_api_url: String,
}

impl EthereumPricePusher {
    pub fn new(
        contract: Arc<SignablePythContract>,
        config: EthereumConfig,
        pyth_price_listener: Arc<dyn PythPriceListener>,
        metrics: Arc<PricePusherMetrics>,
        hermes_api_url: String,
    ) -> Self {
        Self {
            contract,
            config,
            pyth_price_listener,
            metrics,
            hermes_api_url,
        }
    }

    async fn fetch_price_update_data(&self, price_ids: &[[u8; 32]]) -> Result<Vec<Vec<u8>>> {
        Ok(Vec::new())
    }

    async fn push_with_retry(&self, request: PriceUpdateRequest) -> Result<H256> {
        let mut backoff = ExponentialBackoff {
            initial_interval: Duration::from_secs(1),
            max_interval: Duration::from_secs(60),
            multiplier: 1.5,
            max_elapsed_time: Some(Duration::from_secs(300)),
            ..Default::default()
        };

        let mut last_error = None;

        loop {
            match self.push_price_updates_once(&request).await {
                Ok(tx_hash) => {
                    self.metrics.record_success();
                    return Ok(tx_hash);
                }
                Err(err) => {
                    last_error = Some(err);
                    self.metrics.record_failure();

                    match backoff.next_backoff() {
                        Some(duration) => {
                            tokio::time::sleep(duration).await;
                        }
                        None => {
                            return Err(last_error.unwrap());
                        }
                    }
                }
            }
        }
    }

    async fn push_price_updates_once(&self, request: &PriceUpdateRequest) -> Result<H256> {
        let update_data = self.fetch_price_update_data(&request.price_ids).await?;
        
        let tx = self.contract.update_price_feeds(
            request.subscription_id,
            update_data,
            request.price_ids.iter().map(|id| H256::from(*id)).collect(),
        ).send().await?;
        
        Ok(tx.tx_hash())
    }
}

#[async_trait]
impl PricePusher for EthereumPricePusher {
    async fn initialize(&self) -> Result<()> {
        Ok(())
    }

    async fn push_price_updates(&self, request: PriceUpdateRequest) -> Result<H256> {
        self.push_with_retry(request).await
    }
}
