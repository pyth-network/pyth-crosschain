use {
    crate::adapters::types::{Price, PriceId},
    anyhow::Result,
    std::collections::HashMap,
    tokio::sync::RwLock,
};

pub struct ChainPriceState {
    latest_prices: RwLock<HashMap<PriceId, Price>>,
}

impl ChainPriceState {
    pub fn new() -> Self {
        Self {
            latest_prices: RwLock::new(HashMap::new()),
        }
    }


    pub async fn get_all_prices(&self) -> HashMap<PriceId, Price> {
        self.latest_prices.read().await.clone()
    }

    pub async fn get_price(&self, id: &PriceId) -> Option<Price> {
        self.latest_prices.read().await.get(id).cloned()
    }

    pub async fn has_price(&self, id: &PriceId) -> bool {
        self.latest_prices.read().await.contains_key(id)
    }

    pub async fn price_count(&self) -> usize {
        self.latest_prices.read().await.len()
    }


    pub async fn update_price(&self, id: PriceId, price: Price) -> Result<()> {
        let mut prices = self.latest_prices.write().await;
        prices.insert(id, price);
        Ok(())
    }

    pub async fn update_prices(&self, updates: HashMap<PriceId, Price>) -> Result<()> {
        let mut prices = self.latest_prices.write().await;
        for (id, price) in updates {
            prices.insert(id, price);
        }
        Ok(())
    }

    pub async fn remove_price(&self, id: &PriceId) -> Result<()> {
        let mut prices = self.latest_prices.write().await;
        prices.remove(id);
        Ok(())
    }

    pub async fn clear_prices(&self) -> Result<()> {
        let mut prices = self.latest_prices.write().await;
        prices.clear();
        Ok(())
    }
}
