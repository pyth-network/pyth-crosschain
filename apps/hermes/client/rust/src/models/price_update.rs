use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::parsed_price_update::ParsedPriceUpdate;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceUpdate {
    #[serde(rename = "binary", skip_serializing_if = "Option::is_none")]
    pub binary: Option<Vec<String>>,
    
    #[serde(rename = "parsed", skip_serializing_if = "Option::is_none")]
    pub parsed: Option<Option<Vec<ParsedPriceUpdate>>>,
    
    #[serde(flatten)]
    pub additional_properties: HashMap<String, serde_json::Value>,
}

impl PriceUpdate {
    pub fn new() -> PriceUpdate {
        PriceUpdate {
            binary: None,
            parsed: None,
            additional_properties: HashMap::new(),
        }
    }
}
