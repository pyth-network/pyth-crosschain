pub mod price_update;
pub mod parsed_price_update;
pub mod rpc_price;

pub use self::price_update::PriceUpdate;
pub use self::parsed_price_update::{ParsedPriceUpdate, SseEvent};
pub use self::rpc_price::RpcPrice;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum EncodingType {
    #[serde(rename = "base64")]
    Base64,
    #[serde(rename = "hex")]
    Hex,
}

impl std::fmt::Display for EncodingType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EncodingType::Base64 => write!(f, "base64"),
            EncodingType::Hex => write!(f, "hex"),
        }
    }
}
