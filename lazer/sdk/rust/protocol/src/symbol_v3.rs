//! SymbolV3 type for validated symbol strings.

use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

/// A symbol that conforms to the format `source.instrument_type.base[/quote]`.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct SymbolV3 {
    /// The data source (e.g., "pyth", "binance")
    pub source: String,
    /// The instrument type (e.g., "spot", "redemptionrate", "fundingrate")
    pub instrument_type: String,
    /// The base asset ID (e.g., "btc", "alp")
    pub base: String,
    /// The quote asset ID (e.g., "usd", "usdt"), optional
    pub quote: Option<String>,
}

impl SymbolV3 {
    /// Creates a new SymbolV3 from components.
    pub fn new(
        source: String,
        instrument_type: String,
        base: String,
        quote: Option<String>,
    ) -> Self {
        Self {
            source,
            instrument_type,
            base,
            quote,
        }
    }

    /// Returns the symbol as a string in the format `source.instrument_type.base[/quote]`.
    pub fn as_string(&self) -> String {
        match &self.quote {
            Some(quote) => format!(
                "{}.{}.{}/{}",
                self.source, self.instrument_type, self.base, quote
            ),
            None => format!("{}.{}.{}", self.source, self.instrument_type, self.base),
        }
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
        let instrument_type = parts[1].to_string();
        let base_quote_part = parts[2];

        // Split base/quote part
        let base_quote: Vec<&str> = base_quote_part.split('/').collect();

        let (base, quote) = match base_quote.len() {
            1 => {
                // No quote provided
                (base_quote[0].to_string(), None)
            }
            2 => {
                // Quote provided
                let base = base_quote[0].to_string();
                let quote_str = base_quote[1].to_string();
                if quote_str.is_empty() {
                    return Err("Quote asset cannot be empty when slash is present".to_string());
                }
                (base, Some(quote_str))
            }
            _ => {
                return Err(format!(
                    "Invalid base/quote format: expected format 'base' or 'base/quote', got '{}'",
                    base_quote_part
                ));
            }
        };

        // Validate that parts are not empty
        if source.is_empty() {
            return Err("Source cannot be empty".to_string());
        }
        if instrument_type.is_empty() {
            return Err("Instrument type cannot be empty".to_string());
        }
        if base.is_empty() {
            return Err("Base asset cannot be empty".to_string());
        }

        Ok(Self::new(source, instrument_type, base, quote))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parsing_and_roundtrip() {
        // Test parsing with quote
        let cases_with_quote = vec![
            ("pyth.spot.btc/usd", "pyth", "spot", "btc", "usd"),
            (
                "binance.fundingrate.eth/usdt",
                "binance",
                "fundingrate",
                "eth",
                "usdt",
            ),
            (
                "pyth.redemptionrate.alp/usd",
                "pyth",
                "redemptionrate",
                "alp",
                "usd",
            ),
        ];

        for (input, source, instrument, base, quote) in cases_with_quote {
            let symbol: SymbolV3 = input.parse().expect("Failed to parse");
            assert_eq!(symbol.source, source);
            assert_eq!(symbol.instrument_type, instrument);
            assert_eq!(symbol.base, base);
            assert_eq!(symbol.quote, Some(quote.to_string()));
            assert_eq!(symbol.as_string(), input);
            assert_eq!(symbol.to_string(), input);
        }

        // Test parsing without quote
        let cases_without_quote = vec![
            ("pyth.redemptionrate.alp", "pyth", "redemptionrate", "alp"),
            ("pyth.nav.fund", "pyth", "nav", "fund"),
            ("source.index.btc", "source", "index", "btc"),
        ];

        for (input, source, instrument, base) in cases_without_quote {
            let symbol: SymbolV3 = input.parse().expect("Failed to parse");
            assert_eq!(symbol.source, source);
            assert_eq!(symbol.instrument_type, instrument);
            assert_eq!(symbol.base, base);
            assert_eq!(symbol.quote, None);
            assert_eq!(symbol.as_string(), input);
            assert_eq!(symbol.to_string(), input);
        }

        // Test invalid formats
        let invalid = vec![
            "pyth.spot",               // Missing base
            "pyth.spot.btc.usd.extra", // Too many parts
            "pyth",                    // Too few parts
            "",                        // Empty
            ".spot.btc/usd",           // Empty source
            "pyth..btc/usd",           // Empty instrument
            "pyth.spot./usd",          // Empty base
            "pyth.spot.btc/",          // Empty quote with slash
            "pyth.spot.",              // Empty base with dot
            "pyth.spot.btc/usd/extra", // Multiple slashes
        ];

        for input in invalid {
            assert!(
                input.parse::<SymbolV3>().is_err(),
                "Expected parsing to fail for: {}",
                input
            );
        }
    }

    #[test]
    fn test_construction_and_display() {
        // With quote
        let with_quote = SymbolV3::new(
            "pyth".to_string(),
            "spot".to_string(),
            "btc".to_string(),
            Some("usd".to_string()),
        );
        assert_eq!(with_quote.as_string(), "pyth.spot.btc/usd");

        // Without quote
        let without_quote = SymbolV3::new(
            "pyth".to_string(),
            "redemptionrate".to_string(),
            "alp".to_string(),
            None,
        );
        assert_eq!(without_quote.as_string(), "pyth.redemptionrate.alp");
    }

    #[test]
    fn test_serialization() {
        // Test with quote
        let symbol_with_quote = SymbolV3::new(
            "pyth".to_string(),
            "spot".to_string(),
            "btc".to_string(),
            Some("usd".to_string()),
        );
        let json = serde_json::to_string(&symbol_with_quote).unwrap();
        assert_eq!(json, "\"pyth.spot.btc/usd\"");
        let deserialized: SymbolV3 = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, symbol_with_quote);

        // Test without quote
        let symbol_without_quote = SymbolV3::new(
            "pyth".to_string(),
            "nav".to_string(),
            "fund".to_string(),
            None,
        );
        let json = serde_json::to_string(&symbol_without_quote).unwrap();
        assert_eq!(json, "\"pyth.nav.fund\"");
        let deserialized: SymbolV3 = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, symbol_without_quote);

        // Test invalid deserialization
        assert!(serde_json::from_str::<SymbolV3>("\"invalid.format\"").is_err());
    }
}
