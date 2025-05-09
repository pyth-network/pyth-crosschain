use {
    crate::adapters::{
        ethereum::pyth_pulse::SubscriptionParams,
        types::{PriceId, SubscriptionId},
    },
    anyhow::Result,
    std::collections::{HashMap, HashSet},
    tokio::sync::RwLock,
};

pub struct SubscriptionState {
    active_subscriptions: RwLock<HashMap<SubscriptionId, SubscriptionParams>>,
    feed_ids: RwLock<HashSet<PriceId>>,
}

impl SubscriptionState {
    pub fn new() -> Self {
        Self {
            active_subscriptions: RwLock::new(HashMap::new()),
            feed_ids: RwLock::new(HashSet::new()),
        }
    }


    pub async fn get_active_subscriptions(&self) -> HashMap<SubscriptionId, SubscriptionParams> {
        self.active_subscriptions.read().await.clone()
    }

    pub async fn has_subscription(&self, id: &SubscriptionId) -> bool {
        self.active_subscriptions.read().await.contains_key(id)
    }

    pub async fn get_subscription(&self, id: &SubscriptionId) -> Option<SubscriptionParams> {
        self.active_subscriptions.read().await.get(id).cloned()
    }

    pub async fn get_feed_ids(&self) -> HashSet<PriceId> {
        self.feed_ids.read().await.clone()
    }

    pub async fn has_feed_id(&self, id: &PriceId) -> bool {
        self.feed_ids.read().await.contains(id)
    }


    pub async fn upsert_subscription(&self, id: SubscriptionId, params: SubscriptionParams) -> Result<()> {
        let mut subscriptions = self.active_subscriptions.write().await;
        subscriptions.insert(id, params);
        Ok(())
    }

    pub async fn remove_subscription(&self, id: &SubscriptionId) -> Result<()> {
        let mut subscriptions = self.active_subscriptions.write().await;
        subscriptions.remove(id);
        Ok(())
    }

    pub async fn add_feed_id(&self, id: PriceId) -> Result<()> {
        let mut feeds = self.feed_ids.write().await;
        feeds.insert(id);
        Ok(())
    }

    pub async fn remove_feed_id(&self, id: &PriceId) -> Result<()> {
        let mut feeds = self.feed_ids.write().await;
        feeds.remove(id);
        Ok(())
    }

    pub async fn update_feed_ids_from_subscriptions(&self) -> Result<()> {
        let subscriptions = self.active_subscriptions.read().await;
        let mut new_feed_ids = HashSet::new();
        
        for (_, params) in subscriptions.iter() {
            for feed_id in &params.price_ids {
                new_feed_ids.insert(*feed_id);
            }
        }
        
        let mut feed_ids = self.feed_ids.write().await;
        *feed_ids = new_feed_ids;
        
        Ok(())
    }
}
