use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::watch;

use crate::adapters::ethereum::SubscriptionParams;
use crate::adapters::types::{Price, PriceId, SubscriptionId};

#[derive(Clone)]
pub struct ArgusState {
    pub chain_id: String,
    pub subscription_state: Arc<SubscriptionState>,
    pub pyth_price_state: Arc<PythPriceState>,
    pub chain_price_state: Arc<ChainPriceState>,
    pub stop_sender: Arc<Mutex<Option<watch::Sender<bool>>>>,
}

impl ArgusState {
    pub fn new(chain_id: String) -> Self {
        Self {
            chain_id,
            subscription_state: Arc::new(SubscriptionState::new()),
            pyth_price_state: Arc::new(PythPriceState::new()),
            chain_price_state: Arc::new(ChainPriceState::new()),
            stop_sender: Arc::new(Mutex::new(None)),
        }
    }
}

pub struct SubscriptionState {
    subscriptions: RwLock<HashMap<SubscriptionId, SubscriptionParams>>,
}

impl SubscriptionState {
    pub fn new() -> Self {
        Self {
            subscriptions: RwLock::new(HashMap::new()),
        }
    }

    pub fn get_subscriptions(&self) -> HashMap<SubscriptionId, SubscriptionParams> {
        self.subscriptions.read().expect("RwLock poisoned").clone()
    }

    pub fn get_subscription(&self, id: &SubscriptionId) -> Option<SubscriptionParams> {
        self.subscriptions
            .read()
            .expect("RwLock poisoned")
            .get(id)
            .cloned()
    }

    pub fn update_subscriptions(&self, subscriptions: HashMap<SubscriptionId, SubscriptionParams>) {
        let mut lock = self.subscriptions.write().expect("RwLock poisoned");
        *lock = subscriptions;
    }

    pub fn get_feed_ids(&self) -> HashSet<PriceId> {
        let subscriptions = self.subscriptions.read().expect("RwLock poisoned");
        let mut feed_ids = HashSet::new();

        for (_, params) in subscriptions.iter() {
            for feed_id in &params.price_ids {
                feed_ids.insert(*feed_id);
            }
        }

        feed_ids
    }
}

pub struct PythPriceState {
    prices: RwLock<HashMap<PriceId, Price>>,
    feed_ids: RwLock<HashSet<PriceId>>,
}

impl PythPriceState {
    pub fn new() -> Self {
        Self {
            prices: RwLock::new(HashMap::new()),
            feed_ids: RwLock::new(HashSet::new()),
        }
    }

    pub fn get_price(&self, feed_id: &PriceId) -> Option<Price> {
        self.prices
            .read()
            .expect("RwLock poisoned")
            .get(feed_id)
            .cloned()
    }

    pub fn update_price(&self, feed_id: PriceId, price: Price) {
        let mut prices = self.prices.write().expect("RwLock poisoned");
        prices.insert(feed_id, price);
    }

    pub fn update_prices(&self, prices: HashMap<PriceId, Price>) {
        let mut lock = self.prices.write().expect("RwLock poisoned");
        lock.extend(prices);
    }

    pub fn update_feed_ids(&self, feed_ids: HashSet<PriceId>) {
        let mut lock = self.feed_ids.write().expect("RwLock poisoned");
        *lock = feed_ids;
    }

    pub fn get_feed_ids(&self) -> HashSet<PriceId> {
        self.feed_ids.read().expect("RwLock poisoned").clone()
    }
}

pub struct ChainPriceState {
    prices: RwLock<HashMap<PriceId, Price>>,
    feed_ids: RwLock<HashSet<PriceId>>,
}

impl ChainPriceState {
    pub fn new() -> Self {
        Self {
            prices: RwLock::new(HashMap::new()),
            feed_ids: RwLock::new(HashSet::new()),
        }
    }

    pub fn get_price(&self, feed_id: &PriceId) -> Option<Price> {
        self.prices
            .read()
            .expect("RwLock poisoned")
            .get(feed_id)
            .cloned()
    }

    pub fn update_price(&self, feed_id: PriceId, price: Price) {
        let mut prices = self.prices.write().expect("RwLock poisoned");
        prices.insert(feed_id, price);
    }

    pub fn update_prices(&self, prices: HashMap<PriceId, Price>) {
        let mut lock = self.prices.write().expect("RwLock poisoned");
        lock.extend(prices);
    }

    pub fn update_feed_ids(&self, feed_ids: HashSet<PriceId>) {
        let mut lock = self.feed_ids.write().expect("RwLock poisoned");
        *lock = feed_ids;
    }

    pub fn get_feed_ids(&self) -> HashSet<PriceId> {
        self.feed_ids.read().expect("RwLock poisoned").clone()
    }
}
