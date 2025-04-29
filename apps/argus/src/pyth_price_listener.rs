use {
    anyhow::Result,
    async_trait::async_trait,
    std::{collections::HashSet, sync::Arc},
    tokio::sync::RwLock,
};

#[derive(Debug, Clone)]
pub struct PythPrice {
    pub feed_id: [u8; 32],
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
    pub slot: u64,
}

#[async_trait]
pub trait PythPriceListener: Send + Sync {
    async fn initialize(&self) -> Result<()>;

    async fn update_feed_id_set(&self, feed_ids: HashSet<[u8; 32]>) -> Result<()>;

    async fn get_latest_price(&self, feed_id: [u8; 32]) -> Result<Option<PythPrice>>;

    async fn get_latest_prices(&self, feed_ids: &[[u8; 32]]) -> Result<Vec<Option<PythPrice>>>;
}

pub struct HermesPythPriceListener {
    hermes_ws_url: String,
    feed_ids: Arc<RwLock<HashSet<[u8; 32]>>>,
    latest_prices: Arc<RwLock<std::collections::HashMap<[u8; 32], PythPrice>>>,
}

impl HermesPythPriceListener {
    pub fn new(hermes_ws_url: String) -> Self {
        Self {
            hermes_ws_url,
            feed_ids: Arc::new(RwLock::new(HashSet::new())),
            latest_prices: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    async fn connect_to_hermes(&self) -> Result<()> {
        Ok(())
    }

    async fn subscribe_to_price_updates(&self) -> Result<()> {
        Ok(())
    }

    async fn handle_price_update(&self, price: PythPrice) -> Result<()> {
        let mut prices = self.latest_prices.write().await;
        prices.insert(price.feed_id, price);
        Ok(())
    }
}

#[async_trait]
impl PythPriceListener for HermesPythPriceListener {
    async fn initialize(&self) -> Result<()> {
        self.connect_to_hermes().await?;
        
        self.subscribe_to_price_updates().await?;
        
        Ok(())
    }

    async fn update_feed_id_set(&self, feed_ids: HashSet<[u8; 32]>) -> Result<()> {
        let mut current_feed_ids = self.feed_ids.write().await;
        
        if *current_feed_ids != feed_ids {
            *current_feed_ids = feed_ids;
            self.subscribe_to_price_updates().await?;
        }
        
        Ok(())
    }

    async fn get_latest_price(&self, feed_id: [u8; 32]) -> Result<Option<PythPrice>> {
        let prices = self.latest_prices.read().await;
        Ok(prices.get(&feed_id).cloned())
    }

    async fn get_latest_prices(&self, feed_ids: &[[u8; 32]]) -> Result<Vec<Option<PythPrice>>> {
        let prices = self.latest_prices.read().await;
        let result = feed_ids
            .iter()
            .map(|id| prices.get(id).cloned())
            .collect();
        Ok(result)
    }
}
