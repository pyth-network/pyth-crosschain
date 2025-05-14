use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::rpc_price::RpcPrice;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedPriceUpdate {
    #[serde(rename = "id")]
    pub id: String,
    
    #[serde(rename = "price")]
    pub price: RpcPrice,
    
    #[serde(rename = "ema_price", skip_serializing_if = "Option::is_none")]
    pub ema_price: Option<RpcPrice>,
    
    #[serde(rename = "metadata", skip_serializing_if = "Option::is_none")]
    pub metadata: Option<PriceMetadata>,
    
    #[serde(flatten)]
    pub additional_properties: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceMetadata {
    #[serde(rename = "slot", skip_serializing_if = "Option::is_none")]
    pub slot: Option<i64>,
    
    #[serde(rename = "proof_available_time", skip_serializing_if = "Option::is_none")]
    pub proof_available_time: Option<i64>,
    
    #[serde(rename = "prev_publish_time", skip_serializing_if = "Option::is_none")]
    pub prev_publish_time: Option<i64>,
    
    #[serde(flatten)]
    pub additional_properties: HashMap<String, serde_json::Value>,
}

impl ParsedPriceUpdate {
    pub fn new(id: String, price: RpcPrice) -> ParsedPriceUpdate {
        ParsedPriceUpdate {
            id,
            price,
            ema_price: None,
            metadata: None,
            additional_properties: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SseEvent {
    #[serde(rename = "binary", skip_serializing_if = "Option::is_none")]
    pub binary: Option<BinaryData>,
    
    #[serde(rename = "parsed", skip_serializing_if = "Option::is_none")]
    pub parsed: Option<Vec<ParsedPriceUpdate>>,
    
    #[serde(flatten)]
    pub additional_properties: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryData {
    #[serde(rename = "encoding")]
    pub encoding: String,
    
    #[serde(rename = "data")]
    pub data: Vec<String>,
    
    #[serde(flatten)]
    pub additional_properties: HashMap<String, serde_json::Value>,
}
