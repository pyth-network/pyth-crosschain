use {
    ethers::types::{Address, U256},
    serde::{Deserialize, Serialize},
    std::collections::{HashMap, HashSet},
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PythPriceListenerMessage {
    GetLatestPrice(PriceId),
    UpdateFeedIdSet(HashSet<PriceId>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChainPriceListenerMessage {
    GetLatestPrice(PriceId),
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SubscriptionListenerResponse {
    ActiveSubscriptions(HashMap<SubscriptionId, Subscription>),
    RefreshAcknowledged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PythPriceListenerResponse {
    LatestPrice(Option<Price>),
    FeedIdSetUpdated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChainPriceListenerResponse {
    LatestPrice(Option<Price>),
    FeedIdSetUpdated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ControllerResponse {
    UpdateLoopStarted,
    UpdateLoopStopped,
    UpdateCheckResult(Vec<PushRequest>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PricePusherResponse {
    PushResult {
        success: bool,
        subscription_id: SubscriptionId,
        tx_hash: Option<String>,
        error: Option<String>,
    },
}
