use {
    crate::store::UnixTimestamp,
    pyth_sdk::{
        Price,
        PriceFeed,
        PriceIdentifier,
    },
};

type Base64String = String;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RpcPriceFeedMetadata {
    pub emitter_chain:              u16,
    pub attestation_time:           UnixTimestamp,
    pub sequence_number:            u64,
    pub price_service_receive_time: UnixTimestamp,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RpcPriceFeed {
    pub id:        PriceIdentifier,
    pub price:     Price,
    pub ema_price: Price,
    pub metadata:  Option<RpcPriceFeedMetadata>,
    /// Vaa binary represented in base64.
    pub vaa:       Option<Base64String>,
}

impl From<PriceFeed> for RpcPriceFeed {
    fn from(price_feed: PriceFeed) -> Self {
        Self {
            id:        price_feed.id,
            price:     price_feed.get_price_unchecked(),
            ema_price: price_feed.get_ema_price_unchecked(),
            metadata:  None,
            vaa:       None,
        }
    }
}
