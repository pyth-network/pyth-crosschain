use std::str::FromStr;

use anyhow::{anyhow, Context, Result};
use binance_sdk::spot::websocket_streams::BookTickerResponse;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;

/// A single Binance spot top-of-book (`bookTicker`) update.
///
/// `bookTicker` carries no exchange timestamp, so `received_at` is stamped
/// client-side in the stream callback. The per-symbol monotonic `update_id`
/// (`u` in the raw payload) is the ordering tiebreaker and the dedupe key.
#[derive(Clone, Debug, PartialEq)]
pub struct BookTicker {
    pub symbol: String,
    pub update_id: u64,
    pub bid_px: Decimal,
    pub bid_qty: Decimal,
    pub ask_px: Decimal,
    pub ask_qty: Decimal,
    pub received_at: DateTime<Utc>,
}

impl BookTicker {
    /// Build from the SDK's typed `BookTickerResponse`.
    ///
    /// Every field on the SDK model is optional; a missing required field or an
    /// unparseable decimal string is an error so the caller can drop the row
    /// rather than poison the batch. `received_at` is supplied by the caller
    /// (stamped when the message arrives).
    pub fn from_sdk(msg: BookTickerResponse, received_at: DateTime<Utc>) -> Result<Self> {
        let symbol = msg
            .s
            .filter(|s| !s.is_empty())
            .context("missing symbol (s)")?;
        let raw_update_id = msg.u.context("missing update_id (u)")?;
        let update_id = u64::try_from(raw_update_id)
            .map_err(|_| anyhow!("negative update_id (u): {raw_update_id}"))?;

        Ok(Self {
            symbol,
            update_id,
            bid_px: parse_decimal(msg.b.as_deref(), "b")?,
            bid_qty: parse_decimal(msg.b_uppercase.as_deref(), "B")?,
            ask_px: parse_decimal(msg.a.as_deref(), "a")?,
            ask_qty: parse_decimal(msg.a_uppercase.as_deref(), "A")?,
            received_at,
        })
    }

    /// Dedupe key: distinct quote changes have distinct `update_id`s per symbol,
    /// so only exact resends (e.g. a reconnect replay) collapse.
    pub fn dedupe_key(&self) -> (String, u64) {
        (self.symbol.clone(), self.update_id)
    }
}

fn parse_decimal(value: Option<&str>, field: &str) -> Result<Decimal> {
    let value = value.context(format!("missing decimal field {field}"))?;
    Decimal::from_str(value).with_context(|| format!("invalid decimal in field {field}: {value}"))
}
