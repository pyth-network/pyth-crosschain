//! Types describing Lazer's metadata APIs.

use crate::time::{DurationUs, TimestampUs};
use crate::FeedKind;
use crate::{symbol_state::SymbolState, PriceFeedId, SymbolV3};
use serde::{Deserialize, Serialize};

/// The pricing context or type of instrument for a feed.
/// This is an internal type and should not be used by clients as it is non-exhaustive.
/// The API response can evolve to contain additional variants that are not listed here.
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
/// This is an internal type and should not be used by clients as it is non-exhaustive.
/// The API response can evolve to contain additional variants that are not listed here.
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
    /// Commodity
    Commodity,
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
    pub symbol: SymbolV3,
    /// Description of the feed pair.
    /// Example: `"Pyth Network Aggregate Price for spot BTC/USD"`
    pub description: String,
    /// The Asset ID of the base asset.
    /// Example: `"BTC"`
    pub base_asset_id: String,
    /// The Asset ID of the quote asset.
    /// Example: `"USD"`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quote_asset_id: Option<String>,
    /// The pricing context. Should be one of the values in the InstrumentType enum.
    /// Example: `"spot"`
    pub instrument_type: String,
    /// Aggregator or producer of the prices.
    /// Examples: `"pyth"`, `"binance"`
    pub source: String,
    /// The trading schedule of the feed's market, in Pythnet format.
    /// Example: `"America/New_York;O,O,O,O,O,O,O;"`
    pub schedule: String,
    /// Power-of-ten exponent. Scale the `price` mantissa value by `10^exponent` to get the decimal representation.
    /// Example: `-8`
    pub exponent: i32,
    /// Funding rate interval. Only applies to feeds with instrument type `funding_rate`.
    /// Example: `10`
    pub update_interval: DurationUs,
    /// The minimum number of publishers contributing component prices to the aggregate price.
    /// Example: `3`
    pub min_publishers: u32,
    /// Status of the feed.
    /// Example: `"active"`
    pub state: SymbolState,
    /// High-level asset class. One of crypto, fx, equity, metal, rates, nav, commodity, funding-rate.
    /// Should be one of the values in the AssetClass enum.
    /// Example: `"crypto"`
    pub asset_type: String,
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
    pub feed_expiry: Option<TimestampUs>,
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
    /// Example: `"crypto"`
    pub class: String,
    /// More granular categorization within class.
    /// Example: `"stablecoin"`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subclass: Option<String>,
    /// Primary or canonical listing exchange, when applicable.
    /// Example: `"NASDAQ"`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_exchange: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_feed_response_v3_roundtrip() {
        use crate::{symbol_state::SymbolState, FeedKind, PriceFeedId};

        let symbol = SymbolV3::new(
            "pyth".to_string(),
            "spot".to_string(),
            "btc".to_string(),
            Some("usd".to_string()),
        );

        let feed_response = FeedResponseV3 {
            id: PriceFeedId(1),
            name: "Bitcoin / US Dollar".to_string(),
            symbol,
            description: "Pyth Network Aggregate Price for spot BTC/USD".to_string(),
            base_asset_id: "BTC".to_string(),
            quote_asset_id: Some("USD".to_string()),
            instrument_type: "spot".to_string(),
            source: "pyth".to_string(),
            schedule: "America/New_York;O,O,O,O,O,O,O;".to_string(),
            exponent: -8,
            update_interval: DurationUs::from_secs_u32(10),
            min_publishers: 3,
            state: SymbolState::Stable,
            asset_type: "crypto".to_string(),
            cmc_id: Some("1".to_string()),
            pythnet_id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
                .to_string(),
            nasdaq_symbol: None,
            feed_expiry: None,
            feed_kind: FeedKind::Price,
        };

        // Test JSON serialization
        let json =
            serde_json::to_string(&feed_response).expect("Failed to serialize FeedResponseV3");
        assert!(json.contains("\"symbol\":\"pyth.spot.btc/usd\""));

        // Test JSON deserialization
        let deserialized: FeedResponseV3 =
            serde_json::from_str(&json).expect("Failed to deserialize FeedResponseV3");
        assert_eq!(deserialized.symbol.as_string(), "pyth.spot.btc/usd");
        assert_eq!(deserialized.symbol.source, "pyth");
        assert_eq!(deserialized.symbol.instrument_type, "spot");
        assert_eq!(deserialized.symbol.base, "btc");
        assert_eq!(deserialized.symbol.quote, Some("usd".to_string()));

        // Ensure the entire structure matches
        assert_eq!(deserialized, feed_response);
    }
}
