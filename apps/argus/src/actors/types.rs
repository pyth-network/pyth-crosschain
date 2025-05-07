use crate::adapters::types::*;
use {
    ractor::RpcReplyPort,
    serde::{Deserialize, Serialize},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SubscriptionListenerMessage {
    GetActiveSubscriptions,
    RefreshSubscriptions,
}

#[derive(Debug)]
pub enum PythPriceListenerMessage {
    GetLatestPrice(PriceId, RpcReplyPort<Option<Price>>),
    UpdateFeedIdSet(Vec<PriceId>),
}

#[derive(Debug)]
pub enum ChainPriceListenerMessage {
    GetLatestPrice(PriceId, RpcReplyPort<Option<Price>>),
    UpdateFeedIdSet(Vec<PriceId>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ControllerMessage {
    PerformUpdate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushRequest {
    pub subscription_id: SubscriptionId,
    pub price_ids: Vec<PriceId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PricePusherMessage {
    PushPriceUpdates(PushRequest),
}
