use anyhow::Result;
use async_trait::async_trait;
use ethers::{
    contract::ContractError,
    providers::Middleware,
    types::{H256, U256},
};
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, pin::Pin};

use crate::adapters::ethereum::SubscriptionParams;

use super::ethereum::SubscriptionUpdatedFilter;

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
    async fn get_active_subscriptions(&self)
        -> Result<HashMap<SubscriptionId, SubscriptionParams>>;
    async fn subscribe_to_subscription_events(&self) -> Result<()>;
}

#[async_trait]
pub trait ReadPythPrices {
    async fn get_latest_prices(&self, feed_ids: &[PriceId]) -> Result<Vec<Vec<u8>>>;
    async fn subscribe_to_price_updates(&self, feed_ids: &[PriceId]) -> Result<()>; // TODO: return a stream
}

// TODO: find a different home for these (public SDK)

pub type PriceId = [u8; 32];

pub type SubscriptionId = U256;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Price {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
}
