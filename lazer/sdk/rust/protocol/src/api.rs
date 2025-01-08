use serde::{Deserialize, Serialize};

use crate::{payload::AggregatedPriceFeedData, router::PriceFeedId};

/// A request sent from the client to the server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "camelCase")]
pub enum ApiRequest {
    LatestPrice(LatestPriceRequest),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestPriceRequest {
    pub price_feed_ids: Vec<PriceFeedId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestPriceResponse {
    pub latest_prices: Vec<LatestPrice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestPrice {
    pub id: PriceFeedId,
    pub prices: AggregatedPriceFeedData,
}
