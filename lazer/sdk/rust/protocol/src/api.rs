use serde::{Deserialize, Serialize};

use crate::{
    payload::AggregatedPriceFeedData,
    router::{JsonUpdate, PriceFeedId},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestPriceRequest {
    pub price_feed_ids: Vec<PriceFeedId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReducePriceRequest {
    pub payload: JsonUpdate,
    pub price_feed_ids: Vec<PriceFeedId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestPriceResponse {
    pub latest_prices: Vec<LatestPrice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReducePriceResponse {
    pub payload: JsonUpdate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestPrice {
    pub id: PriceFeedId,
    pub exponent: i16,
    pub prices: AggregatedPriceFeedData,
}
