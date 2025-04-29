use {
    crate::{
        chain_price_listener::{ChainPrice, ChainPriceListener},
        config::EthereumConfig,
        metrics::ControllerMetrics,
        price_pusher::{PriceUpdateRequest, PricePusher},
        pyth_price_listener::{PythPrice, PythPriceListener},
        subscription_listener::{Subscription, SubscriptionListener, UpdateCriteria},
    },
    anyhow::Result,
    async_trait::async_trait,
    std::{collections::HashSet, sync::Arc, time::{Duration, SystemTime, UNIX_EPOCH}},
    tokio::time,
};

#[async_trait]
pub trait Controller: Send + Sync {
    async fn initialize(&self) -> Result<()>;

    async fn run(&self) -> Result<()>;
}

pub struct PulseController {
    chain_id: String,
    subscription_listener: Arc<dyn SubscriptionListener>,
    pyth_price_listener: Arc<dyn PythPriceListener>,
    chain_price_listener: Arc<dyn ChainPriceListener>,
    price_pusher: Arc<dyn PricePusher>,
    metrics: Arc<ControllerMetrics>,
    update_interval: Duration,
}

impl PulseController {
    pub fn new(
        chain_id: String,
        subscription_listener: Arc<dyn SubscriptionListener>,
        pyth_price_listener: Arc<dyn PythPriceListener>,
        chain_price_listener: Arc<dyn ChainPriceListener>,
        price_pusher: Arc<dyn PricePusher>,
        metrics: Arc<ControllerMetrics>,
        update_interval: Duration,
    ) -> Self {
        Self {
            chain_id,
            subscription_listener,
            pyth_price_listener,
            chain_price_listener,
            price_pusher,
            metrics,
            update_interval,
        }
    }

    async fn update_feed_id_sets(&self) -> Result<()> {
        let feed_ids = self.subscription_listener.get_all_active_feed_ids().await?;
        
        self.pyth_price_listener.update_feed_id_set(feed_ids.clone()).await?;
        self.chain_price_listener.update_feed_id_set(feed_ids).await?;
        
        Ok(())
    }

    async fn check_subscription_update_needed(
        &self,
        subscription: &Subscription,
    ) -> Result<(bool, Vec<[u8; 32]>)> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let pyth_prices = self.pyth_price_listener.get_latest_prices(&subscription.price_ids).await?;
        let chain_prices = self.chain_price_listener.get_latest_prices(&subscription.price_ids).await?;
        
        let mut update_needed = false;
        let mut feeds_to_update = Vec::new();
        
        for (i, feed_id) in subscription.price_ids.iter().enumerate() {
            let pyth_price = match pyth_prices[i] {
                Some(ref price) => price,
                None => continue, // Skip if no Pyth price
            };
            
            let chain_price = match chain_prices[i] {
                Some(ref price) => price,
                None => {
                    update_needed = true;
                    feeds_to_update.push(*feed_id);
                    continue;
                }
            };
            
            if subscription.update_criteria.update_on_heartbeat {
                let time_since_last_update = now.saturating_sub(chain_price.publish_time);
                if time_since_last_update >= subscription.update_criteria.heartbeat_seconds as u64 {
                    update_needed = true;
                    feeds_to_update.push(*feed_id);
                    continue;
                }
            }
            
            if subscription.update_criteria.update_on_deviation {
                let deviation = self.calculate_price_deviation(pyth_price, chain_price);
                if deviation >= subscription.update_criteria.deviation_threshold_bps as u64 {
                    update_needed = true;
                    feeds_to_update.push(*feed_id);
                    continue;
                }
            }
        }
        
        Ok((update_needed, feeds_to_update))
    }

    fn calculate_price_deviation(&self, pyth_price: &PythPrice, chain_price: &ChainPrice) -> u64 {
        if pyth_price.expo != chain_price.expo {
            return 10000; // 100% deviation if exponents don't match
        }
        
        let pyth_price_abs = pyth_price.price.abs() as u64;
        let chain_price_abs = chain_price.price.abs() as u64;
        
        if pyth_price_abs == 0 && chain_price_abs == 0 {
            return 0;
        }
        
        if pyth_price_abs == 0 || chain_price_abs == 0 {
            return 10000; // 100% deviation if one price is zero
        }
        
        let max_price = std::cmp::max(pyth_price_abs, chain_price_abs);
        let min_price = std::cmp::min(pyth_price_abs, chain_price_abs);
        
        let deviation = (max_price - min_price) * 10000 / max_price;
        deviation
    }

    async fn process_subscription(&self, subscription: &Subscription) -> Result<()> {
        if !subscription.is_active {
            return Ok(());
        }
        
        let (update_needed, feeds_to_update) = self.check_subscription_update_needed(subscription).await?;
        
        if update_needed {
            let request = PriceUpdateRequest {
                subscription_id: subscription.id,
                price_ids: subscription.price_ids.clone(),
            };
            
            match self.price_pusher.push_price_updates(request).await {
                Ok(tx_hash) => {
                    tracing::info!(
                        "Successfully pushed price updates for subscription {} with tx hash {}",
                        subscription.id,
                        tx_hash
                    );
                    self.metrics.record_update_success(subscription.id.as_u64());
                }
                Err(err) => {
                    tracing::error!(
                        "Failed to push price updates for subscription {}: {}",
                        subscription.id,
                        err
                    );
                    self.metrics.record_update_failure(subscription.id.as_u64());
                }
            }
        }
        
        Ok(())
    }

    async fn run_update_loop_once(&self) -> Result<()> {
        let subscriptions = self.subscription_listener.get_active_subscriptions().await?;
        
        self.update_feed_id_sets().await?;
        
        for subscription in subscriptions {
            if let Err(err) = self.process_subscription(&subscription).await {
                tracing::error!(
                    "Error processing subscription {}: {}",
                    subscription.id,
                    err
                );
            }
        }
        
        Ok(())
    }
}

#[async_trait]
impl Controller for PulseController {
    async fn initialize(&self) -> Result<()> {
        self.subscription_listener.initialize().await?;
        self.pyth_price_listener.initialize().await?;
        self.chain_price_listener.initialize().await?;
        self.price_pusher.initialize().await?;
        
        Ok(())
    }

    async fn run(&self) -> Result<()> {
        tracing::info!("Starting controller for chain {}", self.chain_id);
        
        loop {
            if let Err(err) = self.run_update_loop_once().await {
                tracing::error!("Error in update loop: {}", err);
            }
            
            time::sleep(self.update_interval).await;
        }
    }
}
