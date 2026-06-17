use std::str::FromStr;

use anyhow::{anyhow, Context, Result};
use binance_sdk::derivatives_trading_usds_futures::websocket_streams::IndividualSymbolBookTickerStreamsResponse;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;

/// A single Binance USDⓈ-M futures top-of-book (`bookTicker`) update.
///
/// The futures `bookTicker` payload carries an exchange event time (`E`), kept
/// as `event_time`; `received_at` is additionally stamped client-side in the
/// stream callback so transport latency stays measurable. The per-symbol
/// monotonic `update_id` (`u` in the raw payload) is the ordering tiebreaker.
#[derive(Clone, Debug, PartialEq)]
pub struct BookTicker {
    pub symbol: String,
    pub update_id: u64,
    pub bid_px: Decimal,
    pub bid_qty: Decimal,
    pub ask_px: Decimal,
    pub ask_qty: Decimal,
    /// Exchange event time (`E` in the raw payload).
    pub event_time: DateTime<Utc>,
    /// Client receipt time, stamped in the stream callback.
    pub received_at: DateTime<Utc>,
}

impl BookTicker {
    /// Build from the SDK's typed `IndividualSymbolBookTickerStreamsResponse`.
    ///
    /// Every field on the SDK model is optional; a missing required field or an
    /// unparseable decimal string is an error so the caller can drop the row
    /// rather than poison the batch. `received_at` is supplied by the caller
    /// (stamped when the message arrives).
    pub fn from_sdk(
        msg: IndividualSymbolBookTickerStreamsResponse,
        received_at: DateTime<Utc>,
    ) -> Result<Self> {
        let symbol = msg
            .s
            .filter(|s| !s.is_empty())
            .context("missing symbol (s)")?;
        let raw_update_id = msg.u.context("missing update_id (u)")?;
        let update_id = u64::try_from(raw_update_id)
            .map_err(|_| anyhow!("negative update_id (u): {raw_update_id}"))?;
        let raw_event_time = msg.e_uppercase.context("missing event time (E)")?;
        let event_time = DateTime::from_timestamp_millis(raw_event_time)
            .with_context(|| format!("event time (E) out of range: {raw_event_time}"))?;

        Ok(Self {
            symbol,
            update_id,
            bid_px: parse_decimal(msg.b.as_deref(), "b")?,
            bid_qty: parse_decimal(msg.b_uppercase.as_deref(), "B")?,
            ask_px: parse_decimal(msg.a.as_deref(), "a")?,
            ask_qty: parse_decimal(msg.a_uppercase.as_deref(), "A")?,
            event_time,
            received_at,
        })
    }
}

fn parse_decimal(value: Option<&str>, field: &str) -> Result<Decimal> {
    let value = value.context(format!("missing decimal field {field}"))?;
    Decimal::from_str(value).with_context(|| format!("invalid decimal in field {field}: {value}"))
}
