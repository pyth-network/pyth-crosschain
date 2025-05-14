use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcPrice {
    #[serde(rename = "price")]
    pub price: String,
    
    #[serde(rename = "conf")]
    pub conf: String,
    
    #[serde(rename = "expo")]
    pub expo: i32,
    
    #[serde(rename = "publish_time")]
    pub publish_time: i64,
    
    #[serde(flatten)]
    pub additional_properties: HashMap<String, serde_json::Value>,
}

impl RpcPrice {
    pub fn new(price: String, conf: String, expo: i32, publish_time: i64) -> RpcPrice {
        RpcPrice {
            price,
            conf,
            expo,
            publish_time,
            additional_properties: HashMap::new(),
        }
    }
}
