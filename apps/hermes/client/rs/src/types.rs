use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct PriceFeedMetadata {
    attributes: HashMap<String, String>,
    id: String,
}

#[derive(Debug, Serialize)]
pub enum AssetType {
    Crypto,
    Fx,
    Equity,
    Metals,
    Rates,
}
