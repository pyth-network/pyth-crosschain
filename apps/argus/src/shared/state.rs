use {
    crate::adapters::{
        ethereum::pyth_pulse::SubscriptionParams,
        types::{Price, PriceId, SubscriptionId},
    },
    std::{
        collections::{HashMap, HashSet},
        sync::Arc,
    },
    tokio::sync::{RwLock, Mutex},
};

pub struct SubscriptionState {
    pub active_subscriptions: RwLock<HashMap<SubscriptionId, SubscriptionParams>>,
    pub feed_ids: RwLock<HashSet<PriceId>>,
}

impl SubscriptionState {
    pub fn new() -> Self {
        Self {
            active_subscriptions: RwLock::new(HashMap::new()),
            feed_ids: RwLock::new(HashSet::new()),
        }
    }
}

pub struct PythPriceState {
    pub latest_prices: RwLock<HashMap<PriceId, Price>>,
}

impl PythPriceState {
    pub fn new() -> Self {
        Self {
            latest_prices: RwLock::new(HashMap::new()),
        }
    }
}

pub struct ChainPriceState {
    pub latest_prices: RwLock<HashMap<PriceId, Price>>,
}

impl ChainPriceState {
    pub fn new() -> Self {
        Self {
            latest_prices: RwLock::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Clone)]
pub struct PushRequest {
    pub subscription_id: SubscriptionId,
    pub price_ids: Vec<PriceId>,
}

pub struct PushQueue {
    pub requests: Mutex<Vec<PushRequest>>,
}

impl PushQueue {
    pub fn new() -> Self {
        Self {
            requests: Mutex::new(Vec::new()),
        }
    }
}

pub struct ArgusSharedState {
    pub subscription_state: SubscriptionState,
    pub pyth_price_state: PythPriceState,
    pub chain_price_state: ChainPriceState,
    pub push_queue: PushQueue,
}

impl ArgusSharedState {
    pub fn new() -> Self {
        Self {
            subscription_state: SubscriptionState::new(),
            pyth_price_state: PythPriceState::new(),
            chain_price_state: ChainPriceState::new(),
            push_queue: PushQueue::new(),
        }
    }
}
