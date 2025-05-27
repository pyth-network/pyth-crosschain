use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::parsed_price_update::ParsedPriceUpdate;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryData {
    #[serde(rename = "encoding")]
    pub encoding: String,
    
    #[serde(rename = "data")]
    pub data: Vec<String>,
    
    #[serde(flatten)]
    pub additional_properties: HashMap<String, serde_json::Value>,
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

impl SseEvent {
    pub fn new() -> SseEvent {
        SseEvent {
            binary: None,
            parsed: None,
            additional_properties: HashMap::new(),
        }
    }
}

impl Default for SseEvent {
    fn default() -> Self {
        Self::new()
    }
}
