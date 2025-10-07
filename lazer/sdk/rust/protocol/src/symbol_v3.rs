//! SymbolV3 type for validated symbol strings.

use crate::InstrumentType;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

/// A validated symbol that conforms to the format `source.instrument_type.base/quote`.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct SymbolV3 {
    /// The data source (e.g., "pyth", "binance")
    pub source: String,
    /// The instrument type
    pub instrument_type: InstrumentType,
    /// The base asset (e.g., "btc", "alp")
    pub base: String,
    /// The quote asset (e.g., "usd", "usdt")
    pub quote: String,
}

impl SymbolV3 {
    /// Creates a new SymbolV3 from components.
    pub fn new(
        source: String,
        instrument_type: InstrumentType,
        base: String,
        quote: String,
    ) -> Self {
        Self {
            source,
            instrument_type,
            base,
            quote,
        }
    }

    /// Returns the symbol as a string in the format `source.instrument_type.base/quote`.
    pub fn as_string(&self) -> String {
        format!(
            "{}.{}.{}/{}",
            self.source, self.instrument_type, self.base, self.quote
        )
    }
}

impl fmt::Display for SymbolV3 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_string())
    }
}

impl From<SymbolV3> for String {
    fn from(symbol: SymbolV3) -> Self {
        symbol.as_string()
    }
}

impl TryFrom<String> for SymbolV3 {
    type Error = String;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        s.parse()
    }
}

impl FromStr for SymbolV3 {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // Split by dots to get parts
        let parts: Vec<&str> = s.split('.').collect();
        if parts.len() != 3 {
            return Err(format!(
                "Invalid symbol format: expected 3 dot-separated parts, got {}",
                parts.len()
            ));
        }

        let source = parts[0].to_string();
        let instrument_type_str = parts[1];
        let base_quote_part = parts[2];

        // Parse instrument type using its FromStr implementation
        let instrument_type = instrument_type_str
            .parse::<InstrumentType>()
            .map_err(|e| format!("Invalid instrument type '{}': {}", instrument_type_str, e))?;

        // Split base/quote part
        let base_quote: Vec<&str> = base_quote_part.split('/').collect();
        if base_quote.len() != 2 {
            return Err(format!(
                "Invalid base/quote format: expected format 'base/quote', got '{}'",
                base_quote_part
            ));
        }

        let base = base_quote[0].to_string();
        let quote = base_quote[1].to_string();

        // Validate that parts are not empty
        if source.is_empty() {
            return Err("Source cannot be empty".to_string());
        }
        if base.is_empty() {
            return Err("Base asset cannot be empty".to_string());
        }
        if quote.is_empty() {
            return Err("Quote asset cannot be empty".to_string());
        }

        Ok(Self::new(source, instrument_type, base, quote))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_symbol_parsing() {
        // Test various valid symbol formats
        let test_cases = vec![
            (
                "pyth.spot.btc/usd",
                "pyth",
                InstrumentType::Spot,
                "btc",
                "usd",
            ),
            (
                "pyth.redemptionrate.alp/usd",
                "pyth",
                InstrumentType::RedemptionRate,
                "alp",
                "usd",
            ),
            (
                "binance.fundingrate.btc/usdt",
                "binance",
                InstrumentType::FundingRate,
                "btc",
                "usdt",
            ),
            (
                "pyth.future.emz5/usd",
                "pyth",
                InstrumentType::Future,
                "emz5",
                "usd",
            ),
            (
                "exchange.nav.asset/quote",
                "exchange",
                InstrumentType::Nav,
                "asset",
                "quote",
            ),
            (
                "source.twap.base/quote",
                "source",
                InstrumentType::Twap,
                "base",
                "quote",
            ),
        ];

        for (symbol_str, expected_source, expected_instrument, expected_base, expected_quote) in
            test_cases
        {
            let symbol: SymbolV3 = symbol_str
                .parse()
                .expect(&format!("Failed to parse: {}", symbol_str));

            assert_eq!(symbol.source, expected_source);
            assert_eq!(symbol.instrument_type, expected_instrument);
            assert_eq!(symbol.base, expected_base);
            assert_eq!(symbol.quote, expected_quote);

            // Test round-trip conversion
            assert_eq!(symbol.as_string(), symbol_str);
            assert_eq!(symbol.to_string(), symbol_str);
        }
    }

    #[test]
    fn test_invalid_symbol_parsing() {
        let invalid_cases = vec![
            // Wrong number of parts
            "pyth.spot",
            "pyth.spot.btc.usd.extra",
            "pyth",
            "",
            // Invalid instrument type
            "pyth.invalid.btc/usd",
            "pyth.SPOT.btc/usd", // case sensitive
            // Missing slash in base/quote
            "pyth.spot.btcusd",
            "pyth.spot.btc-usd",
            // Empty components
            ".spot.btc/usd",
            "pyth..btc/usd",
            "pyth.spot./usd",
            "pyth.spot.btc/",
            "pyth.spot.btc/",
            // Multiple slashes
            "pyth.spot.btc/usd/extra",
        ];

        for invalid_symbol in invalid_cases {
            assert!(
                invalid_symbol.parse::<SymbolV3>().is_err(),
                "Expected parsing to fail for: {}",
                invalid_symbol
            );
        }
    }

    #[test]
    fn test_symbol_construction() {
        let symbol = SymbolV3::new(
            "pyth".to_string(),
            InstrumentType::Spot,
            "btc".to_string(),
            "usd".to_string(),
        );

        assert_eq!(symbol.source, "pyth");
        assert_eq!(symbol.instrument_type, InstrumentType::Spot);
        assert_eq!(symbol.base, "btc");
        assert_eq!(symbol.quote, "usd");
        assert_eq!(symbol.as_string(), "pyth.spot.btc/usd");
    }

    #[test]
    fn test_symbol_serialization() {
        let symbol = SymbolV3::new(
            "pyth".to_string(),
            InstrumentType::FundingRate,
            "eth".to_string(),
            "usd".to_string(),
        );

        // Test JSON serialization
        let json = serde_json::to_string(&symbol).expect("Failed to serialize");
        assert_eq!(json, "\"pyth.fundingrate.eth/usd\"");

        // Test JSON deserialization
        let deserialized: SymbolV3 = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized, symbol);
    }

    #[test]
    fn test_symbol_deserialization_invalid() {
        // Test that invalid JSON strings fail to deserialize
        let invalid_json = "\"invalid.format\"";
        assert!(serde_json::from_str::<SymbolV3>(invalid_json).is_err());
    }

    #[test]
    fn test_instrument_type_string_mapping() {
        let test_cases = vec![
            (InstrumentType::Spot, "spot"),
            (InstrumentType::RedemptionRate, "redemptionrate"),
            (InstrumentType::FundingRate, "fundingrate"),
            (InstrumentType::Future, "future"),
            (InstrumentType::Nav, "nav"),
            (InstrumentType::Twap, "twap"),
        ];

        for (instrument_type, expected_str) in test_cases {
            let symbol = SymbolV3::new(
                "test".to_string(),
                instrument_type,
                "base".to_string(),
                "quote".to_string(),
            );

            let symbol_str = symbol.as_string();
            assert!(
                symbol_str.contains(expected_str),
                "Expected symbol '{}' to contain '{}'",
                symbol_str,
                expected_str
            );
        }
    }

    #[test]
    fn test_symbol_equality_and_hash() {
        let symbol1 = SymbolV3::new(
            "pyth".to_string(),
            InstrumentType::Spot,
            "btc".to_string(),
            "usd".to_string(),
        );

        let symbol2 = SymbolV3::new(
            "pyth".to_string(),
            InstrumentType::Spot,
            "btc".to_string(),
            "usd".to_string(),
        );

        let symbol3 = SymbolV3::new(
            "binance".to_string(),
            InstrumentType::Spot,
            "btc".to_string(),
            "usd".to_string(),
        );

        assert_eq!(symbol1, symbol2);
        assert_ne!(symbol1, symbol3);

        // Test that equal symbols have the same hash
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(symbol1.clone());
        assert!(set.contains(&symbol2));
        assert!(!set.contains(&symbol3));
    }
}
