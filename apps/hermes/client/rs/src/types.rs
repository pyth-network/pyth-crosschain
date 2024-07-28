use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub enum AssetType {
    Crypto,
    Fx,
    Equity,
    Metals,
    Rates,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum EncodingType {
    Hex,
    Base64,
}

// #[derive(Debug, Deserialize)]
// pub struct PriceFeedMetadata {
//     attributes: HashMap<String, String>,
//     id: String,
// }

#[derive(Debug, Deserialize)]
pub struct BinaryPriceUpdate {
    data: String,
    encoding: EncodingType,
}

#[derive(Debug, Deserialize)]
pub struct ParsedPriceUpdate {
    ema_price: RpcPrice,
}
