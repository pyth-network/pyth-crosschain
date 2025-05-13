//! This module contains the state of the service for a single blockchain.

use dashmap::DashMap;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use crate::adapters::ethereum::SubscriptionParams;
use crate::adapters::types::{PriceId, SubscriptionId};
use pyth_sdk::Price;

pub type ChainName = String;

/// The state of Argus for a single blockchain.
/// Each sub state object should be a singleton and is shared across services.
#[derive(Clone)]
pub struct ArgusState {
    pub subscription_state: Arc<SubscriptionState>,
    pub pyth_price_state: Arc<PythPriceState>,
    pub chain_price_state: Arc<ChainPriceState>,
}

impl ArgusState {
    pub fn new() -> Self {
        Self {
            subscription_state: Arc::new(SubscriptionState::new()),
            pyth_price_state: Arc::new(PythPriceState::new()),
            chain_price_state: Arc::new(ChainPriceState::new()),
        }
    }
}

/// The state of active subscriptions for a single blockchain.
/// Updated by the SubscriptionService.
pub struct SubscriptionState {
    subscriptions: DashMap<SubscriptionId, SubscriptionParams>,
}

impl SubscriptionState {
    pub fn new() -> Self {
        Self {
            subscriptions: DashMap::new(),
        }
    }

    pub fn get_subscriptions(&self) -> HashMap<SubscriptionId, SubscriptionParams> {
        self.subscriptions
            .iter()
            .map(|r| (*r.key(), r.value().clone()))
            .collect()
    }

    pub fn get_subscription(&self, id: &SubscriptionId) -> Option<SubscriptionParams> {
        self.subscriptions.get(id).map(|r| r.value().clone())
    }

    pub fn update_subscriptions(&self, subscriptions: HashMap<SubscriptionId, SubscriptionParams>) {
        self.subscriptions.clear();
        for (id, params) in subscriptions {
            self.subscriptions.insert(id, params);
        }
    }

    pub fn get_feed_ids(&self) -> HashSet<PriceId> {
        let mut feed_ids: HashSet<PriceId> = HashSet::new();
        for entry in self.subscriptions.iter() {
            for feed_id in &entry.value().price_ids {
                feed_ids.insert(PriceId::new(*feed_id));
            }
        }
        feed_ids
    }
}

/// Stores the latest off-chain prices for a given set of price feeds.
/// Updated by the PythPriceService.
pub struct PythPriceState {
    prices: DashMap<PriceId, Price>,
    feed_ids: DashMap<PriceId, ()>,
}

impl PythPriceState {
    pub fn new() -> Self {
        Self {
            prices: DashMap::new(),
            feed_ids: DashMap::new(),
        }
    }

    pub fn get_price(&self, feed_id: &PriceId) -> Option<Price> {
        self.prices.get(feed_id).map(|r| r.value().clone())
    }

    pub fn update_price(&self, feed_id: PriceId, price: Price) {
        self.prices.insert(feed_id, price);
    }

    pub fn update_prices(&self, prices: HashMap<PriceId, Price>) {
        for (feed_id, price) in prices {
            self.prices.insert(feed_id, price);
        }
    }

    pub fn update_feed_ids(&self, feed_ids: HashSet<PriceId>) {
        self.feed_ids.clear();
        for feed_id in feed_ids {
            self.feed_ids.insert(feed_id, ());
        }
    }

    pub fn get_feed_ids(&self) -> HashSet<PriceId> {
        self.feed_ids.iter().map(|r| *r.key()).collect()
    }
}

/// Stores the latest on-chain prices for a given set of price feeds.
/// Updated by the ChainPriceService.
pub struct ChainPriceState {
    prices: DashMap<PriceId, Price>,
    feed_ids: DashMap<PriceId, ()>,
}

impl ChainPriceState {
    pub fn new() -> Self {
        Self {
            prices: DashMap::new(),
            feed_ids: DashMap::new(),
        }
    }

    pub fn get_price(&self, feed_id: &PriceId) -> Option<Price> {
        self.prices.get(feed_id).map(|r| r.value().clone())
    }

    pub fn update_price(&self, feed_id: PriceId, price: Price) {
        self.prices.insert(feed_id, price);
    }

    pub fn update_prices(&self, prices: HashMap<PriceId, Price>) {
        for (feed_id, price) in prices {
            self.prices.insert(feed_id, price);
        }
    }

    pub fn update_feed_ids(&self, feed_ids: HashSet<PriceId>) {
        self.feed_ids.clear();
        for feed_id in feed_ids {
            self.feed_ids.insert(feed_id, ());
        }
    }

    pub fn get_feed_ids(&self) -> HashSet<PriceId> {
        self.feed_ids.iter().map(|r| *r.key()).collect()
    }
}
