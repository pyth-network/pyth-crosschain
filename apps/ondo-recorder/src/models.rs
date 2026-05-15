use std::str::FromStr;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

fn wei_divisor() -> Decimal {
    // 10^18 — the scale factor used by the Ondo API for token amounts and prices.
    Decimal::from_str("1000000000000000000").expect("valid constant")
}

#[derive(Clone, Debug, Serialize)]
pub struct OndoApiRequest {
    #[serde(rename = "chainId")]
    pub chain_id: String,
    pub symbol: String,
    pub side: String,
    #[serde(rename = "tokenAmount")]
    pub token_amount: String,
    pub duration: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct OndoApiResponse {
    #[serde(rename = "chainId")]
    pub chain_id: String,
    pub symbol: String,
    pub ticker: String,
    #[serde(rename = "assetAddress")]
    pub asset_address: String,
    pub side: String,
    #[serde(rename = "tokenAmount")]
    pub token_amount: String,
    pub price: String,
}

#[derive(Clone, Debug)]
pub struct OndoQuote {
    pub symbol: String,
    pub ticker: String,
    pub chain_id: String,
    pub side: String,
    pub token_amount: Decimal,
    pub price: Decimal,
    pub asset_address: String,
    pub polled_at: DateTime<Utc>,
}

impl OndoQuote {
    /// Build from the raw API response, using the request's `side` and `chain_id`
    /// (the API returns numeric encodings for these fields).
    /// Token amounts and prices are normalized from 18-decimal wei format to
    /// human-readable values (e.g. 1000000000000000000 → 1.0).
    pub fn from_api_response(
        response: OndoApiResponse,
        request_side: &str,
        request_chain_id: &str,
        polled_at: DateTime<Utc>,
    ) -> Result<Self> {
        let token_amount_wei = parse_decimal(&response.token_amount, "tokenAmount")?;
        let price_wei = parse_decimal(&response.price, "price")?;
        Ok(Self {
            symbol: response.symbol,
            ticker: response.ticker,
            chain_id: request_chain_id.to_string(),
            side: request_side.to_string(),
            token_amount: token_amount_wei / wei_divisor(),
            price: price_wei / wei_divisor(),
            asset_address: response.asset_address,
            polled_at,
        })
    }
}

fn parse_decimal(value: &str, field: &str) -> Result<Decimal> {
    Decimal::from_str(value).with_context(|| format!("invalid decimal in field {field}: {value}"))
}
