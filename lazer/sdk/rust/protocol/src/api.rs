use serde::{Deserialize, Serialize};

use crate::router::{Chain, Channel, JsonUpdate, PriceFeedId, PriceFeedProperty};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestPriceRequest {
    pub price_feed_ids: Vec<PriceFeedId>,
    pub properties: Vec<PriceFeedProperty>,
    pub chains: Vec<Chain>,
    /// If `true`, the stream update will contain a JSON object containing
    /// all data of the update.
    #[serde(default = "default_parsed")]
    pub parsed: bool,
    pub channel: Channel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReducePriceRequest {
    pub payload: JsonUpdate,
    pub price_feed_ids: Vec<PriceFeedId>,
}

pub type LatestPriceResponse = JsonUpdate;
pub type ReducePriceResponse = JsonUpdate;

pub fn default_parsed() -> bool {
    true
}
