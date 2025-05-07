use anyhow::Result;
use async_trait::async_trait;
use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[async_trait]
pub trait UpdateChainPrices {
    async fn update_price_feeds(
        &self,
        subscription_id: SubscriptionId,
        price_ids: &[PriceId],
        update_data: &[Vec<u8>],
    ) -> Result<H256>;
}

#[async_trait]
pub trait ReadChainSubscriptions {
    async fn get_active_subscriptions(&self) -> Result<HashMap<SubscriptionId, Subscription>>;
    async fn subscribe_to_subscription_events(&self) -> Result<()>; // TODO: return a stream
}

#[async_trait]
pub trait ReadPythPrices {
    async fn get_latest_prices(&self, feed_ids: &[PriceId]) -> Result<Vec<Vec<u8>>>;
    async fn subscribe_to_price_updates(&self, feed_ids: &[PriceId]) -> Result<()>; // TODO: return a stream
}

// TODO: find a different home for these

pub type PriceId = [u8; 32];

pub type SubscriptionId = u64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Price {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: SubscriptionId,
    pub price_ids: Vec<PriceId>,
    pub manager: Address,
    pub is_active: bool,
    pub update_criteria: UpdateCriteria,
    pub last_updated_at: u64,
    pub balance: U256,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCriteria {
    pub update_on_heartbeat: bool,
    pub heartbeat_seconds: u32,
    pub update_on_deviation: bool,
    pub deviation_threshold_bps: u32,
}

pub struct SubscriptionEvent;
