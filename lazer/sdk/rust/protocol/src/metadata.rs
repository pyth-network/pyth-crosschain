//! Types describing Lazer's metadata APIs.

use crate::FeedKind;
use crate::{symbol_state::SymbolState, PriceFeedId};
use serde::{Deserialize, Serialize};

/// The pricing context or type of instrument for a feed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstrumentType {
    /// Spot price
    Spot,
    /// Redemption rate
    #[serde(rename = "redemptionrate")]
    RedemptionRate,
    /// Funding rate
    #[serde(rename = "fundingrate")]
    FundingRate,
    /// Future price
    Future,
    /// Net Asset Value
    Nav,
    /// Time-weighted average price
    Twap,
}

/// High-level asset class.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AssetClass {
    /// Cryptocurrency
    Crypto,
    /// Foreign exchange
    Fx,
    /// Equity
    Equity,
    /// Metal
    Metal,
    /// Rates
    Rates,
    /// Net Asset Value
    Nav,
    /// Commodity
    Commodity,
    /// Funding rate
    FundingRate,
}

/// Feed metadata as returned by the v3 metadata API.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FeedResponseV3 {
    /// Unique integer identifier for a feed. Known as `pyth_lazer_id` in V1 API.
    /// Example: `1`
    pub id: PriceFeedId,
    /// Short feed name.
    /// Example: `"Bitcoin / US Dollar"`
    pub name: String,
    /// Unique human-readable identifier for a feed.
    /// Format: `source.instrument_type.base/quote`
    /// Examples: `"pyth.spot.btc/usd"`, `"pyth.redemptionrate.alp/usd"`, `"binance.fundingrate.btc/usdt"`, `"pyth.future.emz5/usd"`
    pub symbol: String,
    /// Description of the feed pair.
    /// Example: `"Pyth Network Aggregate Price for spot BTC/USD"`
    pub description: String,
    /// The Asset ID of the base asset.
    /// Example: `"BTC"`
    pub base_asset_id: String,
    /// The Asset ID of the quote asset.
    /// Example: `"USD"`
    pub quote_asset_id: String,
    /// The pricing context.
    /// Example: `InstrumentType::Spot`
    pub instrument_type: InstrumentType,
    /// Aggregator or producer of the prices.
    /// Examples: `"pyth"` for our aggregations, `"binance"` for their funding rates
    pub source: String,
    /// The trading schedule of the feed's market, in Pythnet format.
    /// Example: `"America/New_York;O,O,O,O,O,O,O;"`
    pub schedule: String,
    /// Power-of-ten exponent. Scale the `price` mantissa value by `10^exponent` to get the decimal representation.
    /// Example: `-8`
    pub exponent: i32,
    /// Funding rate interval. Only applies to feeds with instrument type `funding_rate`.
    /// Example: `10`
    pub update_interval_seconds: i32,
    /// The minimum number of publishers contributing component prices to the aggregate price.
    /// Example: `3`
    pub min_publishers: i32,
    /// Status of the feed.
    /// Example: `SymbolState::Active`
    pub state: SymbolState,
    /// High-level asset class. One of crypto, fx, equity, metal, rates, nav, commodity, funding-rate.
    /// Example: `AssetClass::Crypto`
    pub asset_type: AssetClass,
    /// CoinMarketCap asset identifier.
    /// Example: `"123"`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cmc_id: Option<String>,
    /// Pythnet feed identifier. 32 bytes, represented in hex.
    /// Example: `"e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"`
    pub pythnet_id: String,
    /// Nasdaq symbol identifier.
    /// Example: `"ADSK"`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nasdaq_symbol: Option<String>,
    /// ISO datetime after which the feed will no longer produce prices because the underlying market has expired.
    /// Example: `"2025-10-03T11:08:10.089998603Z"`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feed_expiry: Option<String>,
    /// The nature of the data produced by the feed.
    /// Examples: `"price"`, `"fundingRate"`
    pub feed_kind: FeedKind,
}

/// Asset metadata as returned by the v3 metadata API.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AssetResponseV3 {
    /// Unique identifier for an asset.
    /// Example: `"BTC"`
    pub id: String,
    /// A short, human-readable code that identifies an asset. Not guaranteed to be unique.
    /// Example: `"BTC"`
    pub ticker: String,
    /// Full human-readable name of the asset.
    /// Example: `"Bitcoin"`
    pub full_name: String,
    /// High-level asset class.
    /// Example: `AssetClass::Crypto`
    pub class: AssetClass,
    /// More granular categorization within class.
    /// Example: `"stablecoin"`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subclass: Option<String>,
    /// Primary or canonical listing exchange, when applicable.
    /// Example: `"NASDAQ"`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub listing_exchange: Option<String>,
}
