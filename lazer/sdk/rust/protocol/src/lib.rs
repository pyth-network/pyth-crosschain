//! Lazer type definitions and utilities.

/// Types describing Lazer HTTP and WebSocket APIs.
pub mod api;
/// Binary delivery format for WebSocket.
pub mod binary_update;
mod dynamic_value;
mod feed_kind;
/// Lazer Agent JSON-RPC API.
pub mod jrpc;
/// Types describing Lazer's verifiable messages containing signature and payload.
pub mod message;
/// Types describing Lazer's message payload.
pub mod payload;
mod price;
/// Legacy Websocket API for publishers.
pub mod publisher;
mod rate;
mod serde_price_as_i64;
mod serde_str;
mod symbol_state;
/// Lazer's types for time representation.
pub mod time;

use derive_more::derive::{From, Into};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub use crate::{
    dynamic_value::DynamicValue,
    feed_kind::FeedKind,
    price::{Price, PriceError},
    rate::{Rate, RateError},
    symbol_state::SymbolState,
};

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, From, Into,
)]
pub struct AssetId(pub u32);

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, From, Into,
)]
pub struct PublisherId(pub u16);

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Hash,
    PartialOrd,
    Ord,
    Serialize,
    Deserialize,
    From,
    Into,
    ToSchema,
)]
#[schema(value_type = u32)]
pub struct PriceFeedId(pub u32);

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, From, Into,
)]
pub struct ChannelId(pub u8);

impl ChannelId {
    pub const REAL_TIME: ChannelId = ChannelId(1);
    pub const FIXED_RATE_50: ChannelId = ChannelId(2);
    pub const FIXED_RATE_200: ChannelId = ChannelId(3);
    pub const FIXED_RATE_1000: ChannelId = ChannelId(4);
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum PriceFeedProperty {
    Price,
    BestBidPrice,
    BestAskPrice,
    PublisherCount,
    Exponent,
    Confidence,
    FundingRate,
    FundingTimestamp,
    FundingRateInterval,
    MarketSession,
    // More fields may be added later.
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AssetClass {
    Crypto,
    Fx,
    Equity,
    Metal,
    Rates,
    Nav,
    Commodity,
    FundingRate,
}

impl AssetClass {
    pub fn as_str(&self) -> &'static str {
        match self {
            AssetClass::Crypto => "crypto",
            AssetClass::Fx => "fx",
            AssetClass::Equity => "equity",
            AssetClass::Metal => "metal",
            AssetClass::Rates => "rates",
            AssetClass::Nav => "nav",
            AssetClass::Commodity => "commodity",
            AssetClass::FundingRate => "funding-rate",
        }
    }
}

// Operation and coefficient for converting value to mantissa.
enum ExponentFactor {
    // mantissa = value * factor
    Mul(i64),
    // mantissa = value / factor
    Div(i64),
}

impl ExponentFactor {
    fn get(exponent: i16) -> Option<Self> {
        if exponent >= 0 {
            let exponent: u32 = exponent.try_into().ok()?;
            Some(ExponentFactor::Div(10_i64.checked_pow(exponent)?))
        } else {
            let minus_exponent: u32 = exponent.checked_neg()?.try_into().ok()?;
            Some(ExponentFactor::Mul(10_i64.checked_pow(minus_exponent)?))
        }
    }
}

#[test]
fn magics_in_big_endian() {
    use crate::{
        binary_update::BINARY_UPDATE_FORMAT_MAGIC,
        message::format_magics_le::{
            EVM_FORMAT_MAGIC, JSON_FORMAT_MAGIC, LE_ECDSA_FORMAT_MAGIC, LE_UNSIGNED_FORMAT_MAGIC,
            SOLANA_FORMAT_MAGIC,
        },
        payload::PAYLOAD_FORMAT_MAGIC,
    };

    // The values listed in this test can be used when reading the magic headers in BE format
    // (e.g., on EVM).

    assert_eq!(u32::swap_bytes(BINARY_UPDATE_FORMAT_MAGIC), 1937213467);
    assert_eq!(u32::swap_bytes(PAYLOAD_FORMAT_MAGIC), 1976813459);

    assert_eq!(u32::swap_bytes(SOLANA_FORMAT_MAGIC), 3103857282);
    assert_eq!(u32::swap_bytes(JSON_FORMAT_MAGIC), 2584795844);
    assert_eq!(u32::swap_bytes(EVM_FORMAT_MAGIC), 706910618);
    assert_eq!(u32::swap_bytes(LE_ECDSA_FORMAT_MAGIC), 3837609805);
    assert_eq!(u32::swap_bytes(LE_UNSIGNED_FORMAT_MAGIC), 206398297);

    for magic in [
        BINARY_UPDATE_FORMAT_MAGIC,
        PAYLOAD_FORMAT_MAGIC,
        SOLANA_FORMAT_MAGIC,
        JSON_FORMAT_MAGIC,
        EVM_FORMAT_MAGIC,
        LE_ECDSA_FORMAT_MAGIC,
        LE_UNSIGNED_FORMAT_MAGIC,
    ] {
        // Required to distinguish between byte orders.
        assert_ne!(u32::swap_bytes(magic), magic);
    }
}
