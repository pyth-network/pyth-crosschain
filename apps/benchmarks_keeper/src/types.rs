use alloy::primitives::Bytes;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type UnixTimestamp = i64;

#[derive(Debug, Deserialize)]
pub struct HermesResponse {
    pub binary: BinaryUpdate,
    pub parsed: Option<Vec<ParsedPriceUpdate>>,
}

#[derive(Debug, Deserialize)]
pub struct BinaryUpdate {
    pub encoding: String,
    pub data: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ParsedPriceUpdate {
    pub id: String,
    pub price: Price,
    pub ema_price: Price,
    pub metadata: Metadata,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Price {
    pub price: String,
    pub conf: String,
    pub expo: i32,
    pub publish_time: i64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Metadata {
    pub slot: Option<u64>,
    pub prev_publish_time: Option<i64>,
    pub proof_available_time: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PriceUpdateResult {
    pub price: Price,
    pub ema_price: Price,
    pub metadata: Metadata,
}

#[derive(Debug, Serialize)]
pub struct PriceUpdateResults {
    pub results: HashMap<String, PriceUpdateResult>,
    pub client_context: Bytes,
}
