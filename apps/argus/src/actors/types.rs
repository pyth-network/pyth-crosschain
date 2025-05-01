use {
    ethers::types::{Address, U256},
    ractor::RpcReplyPort,
    serde::{Deserialize, Serialize},
    std::collections::HashSet,
};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SubscriptionListenerMessage {
    GetActiveSubscriptions,
    RefreshSubscriptions,
}

#[derive(Debug)]
pub enum PythPriceListenerMessage {
    GetLatestPrice(PriceId, RpcReplyPort<Option<Price>>),
    UpdateFeedIdSet(HashSet<PriceId>),
}

#[derive(Debug)]
pub enum ChainPriceListenerMessage {
    GetLatestPrice(PriceId, RpcReplyPort<Option<Price>>),
    UpdateFeedIdSet(HashSet<PriceId>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ControllerMessage {
    StartUpdateLoop,
    StopUpdateLoop,
    CheckForUpdates,
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
