use std::collections::{HashMap, HashSet};
use anyhow::Result;
use async_trait::async_trait;

use crate::adapters::types::{Price, PriceId, SubscriptionId};
use crate::state::SubscriptionParams;

pub trait ReadSubscriptionState: Send + Sync {
    fn get_subscriptions(&self) -> HashMap<SubscriptionId, SubscriptionParams>;
    
    fn get_subscription(&self, id: &SubscriptionId) -> Option<SubscriptionParams>;
    
    fn get_feed_ids(&self) -> HashSet<PriceId>;
}

pub trait WriteSubscriptionState: ReadSubscriptionState {
    fn update_subscriptions(&self, subscriptions: HashMap<SubscriptionId, SubscriptionParams>);
}

pub trait ReadPythPriceState: Send + Sync {
    fn get_price(&self, feed_id: &PriceId) -> Option<Price>;
    
    fn get_feed_ids(&self) -> HashSet<PriceId>;
}

pub trait WritePythPriceState: ReadPythPriceState {
    fn update_price(&self, feed_id: PriceId, price: Price);
    
    fn update_prices(&self, prices: HashMap<PriceId, Price>);
    
    fn update_feed_ids(&self, feed_ids: HashSet<PriceId>);
}

pub trait ReadChainPriceState: Send + Sync {
    fn get_price(&self, feed_id: &PriceId) -> Option<Price>;
    
    fn get_feed_ids(&self) -> HashSet<PriceId>;
}

pub trait WriteChainPriceState: ReadChainPriceState {
    fn update_price(&self, feed_id: PriceId, price: Price);
    
    fn update_prices(&self, prices: HashMap<PriceId, Price>);
    
    fn update_feed_ids(&self, feed_ids: HashSet<PriceId>);
}

pub trait SystemControl: Send + Sync {
    fn signal_shutdown(&self) -> Result<()>;
}
