use std::str::FromStr;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;

/// OKX public websocket channel name for tick-by-tick top-of-book updates.
pub const BBO_TBT_CHANNEL: &str = "bbo-tbt";

/// A parsed row destined for ClickHouse, tagged by lane.
///
/// Each lane (channel or poller) maps to its own ClickHouse table; the writer
/// loop routes rows by variant. Currently only the ToB lane exists — trades and
/// funding variants bolt on here when their lanes land.
#[derive(Clone, Debug, PartialEq)]
pub enum LaneRow {
    BookTicker(BookTicker),
}

/// A single OKX top-of-book (`bbo-tbt`) update for one instrument.
///
/// The payload carries an exchange timestamp (`ts`), kept as `ts`;
/// `received_at` is additionally stamped client-side when the frame arrives so
/// transport latency stays measurable. `seq_id` is OKX's per-instrument
/// sequence id, the ordering tiebreaker. Either book side can be missing when
/// the book is one-sided, so both sides are optional.
#[derive(Clone, Debug, PartialEq)]
pub struct BookTicker {
    pub inst_id: String,
    pub seq_id: i64,
    pub bid_px: Option<Decimal>,
    pub bid_qty: Option<Decimal>,
    pub ask_px: Option<Decimal>,
    pub ask_qty: Option<Decimal>,
    /// Exchange timestamp (`ts` in the raw payload, epoch milliseconds).
    pub ts: DateTime<Utc>,
    /// Client receipt time, stamped when the websocket frame arrives.
    pub received_at: DateTime<Utc>,
}

/// One frame received on the OKX public websocket, classified.
#[derive(Debug)]
pub enum ParsedFrame {
    /// Control frame: subscribe ack, unsubscribe ack, or error event.
    Event {
        event: String,
        code: Option<String>,
        message: Option<String>,
    },
    /// Data push for a recorded lane. `inst_id` comes from the frame's `arg`
    /// and is shared by every row in the frame.
    Data { inst_id: String, rows: Vec<LaneRow> },
    /// Data push for a channel this recorder does not record.
    UnhandledChannel { channel: String },
}

/// Envelope shared by every OKX websocket frame: control frames carry `event`
/// (plus `code`/`msg` on errors), data pushes carry `arg` + `data`. The `data`
/// payload shape depends on `arg.channel`, so it stays untyped until the
/// channel is known.
#[derive(Debug, Deserialize)]
struct RawFrame {
    event: Option<String>,
    code: Option<String>,
    msg: Option<String>,
    arg: Option<ChannelArg>,
    data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct ChannelArg {
    channel: String,
    #[serde(rename = "instId")]
    inst_id: String,
}

/// A `bbo-tbt` data entry. `asks`/`bids` are arrays of
/// `[price, size, liquidated-orders, order-count]` string arrays (at most one
/// level on this channel); either side can be absent or empty. All decimals
/// arrive as strings.
#[derive(Debug, Deserialize)]
struct RawBboEntry {
    #[serde(default)]
    asks: Vec<Vec<String>>,
    #[serde(default)]
    bids: Vec<Vec<String>>,
    ts: String,
    #[serde(rename = "seqId")]
    seq_id: i64,
}

/// Parse one raw websocket text frame into a [`ParsedFrame`].
///
/// A malformed frame is an error so the caller can drop it rather than poison
/// the batch. `received_at` is supplied by the caller (stamped when the frame
/// arrives).
pub fn parse_frame(text: &str, received_at: DateTime<Utc>) -> Result<ParsedFrame> {
    let frame: RawFrame =
        serde_json::from_str(text).context("malformed websocket frame (not a JSON object)")?;

    if let Some(event) = frame.event {
        return Ok(ParsedFrame::Event {
            event,
            code: frame.code,
            message: frame.msg,
        });
    }

    let arg = frame.arg.context("frame has neither event nor arg")?;
    match arg.channel.as_str() {
        BBO_TBT_CHANNEL => {
            let data = frame.data.context("bbo-tbt frame missing data")?;
            let entries: Vec<RawBboEntry> =
                serde_json::from_value(data).context("malformed bbo-tbt data entries")?;
            let mut rows = Vec::with_capacity(entries.len());
            for entry in entries {
                rows.push(LaneRow::BookTicker(BookTicker::from_entry(
                    &arg.inst_id,
                    entry,
                    received_at,
                )?));
            }
            Ok(ParsedFrame::Data {
                inst_id: arg.inst_id,
                rows,
            })
        }
        other => Ok(ParsedFrame::UnhandledChannel {
            channel: other.to_string(),
        }),
    }
}

impl BookTicker {
    fn from_entry(inst_id: &str, entry: RawBboEntry, received_at: DateTime<Utc>) -> Result<Self> {
        let raw_ts: i64 = entry
            .ts
            .parse()
            .with_context(|| format!("invalid ts: {}", entry.ts))?;
        let ts = DateTime::from_timestamp_millis(raw_ts)
            .with_context(|| format!("ts out of range: {raw_ts}"))?;
        let (bid_px, bid_qty) = parse_best_level(&entry.bids, "bids")?;
        let (ask_px, ask_qty) = parse_best_level(&entry.asks, "asks")?;

        Ok(Self {
            inst_id: inst_id.to_string(),
            seq_id: entry.seq_id,
            bid_px,
            bid_qty,
            ask_px,
            ask_qty,
            ts,
            received_at,
        })
    }
}

/// Extract `(price, size)` from the best level of one book side.
///
/// A missing or empty side is a one-sided book, not an error: both fields come
/// back `None` and the row is still recorded. A present-but-malformed level
/// (fewer than two elements, or an unparseable decimal) is an error so the row
/// is dropped instead of stored half-parsed.
fn parse_best_level(
    levels: &[Vec<String>],
    side: &str,
) -> Result<(Option<Decimal>, Option<Decimal>)> {
    let Some(level) = levels.first() else {
        return Ok((None, None));
    };
    let px = level
        .first()
        .with_context(|| format!("{side} level missing price"))?;
    let qty = level
        .get(1)
        .with_context(|| format!("{side} level missing size"))?;
    Ok((
        Some(parse_decimal(px, side)?),
        Some(parse_decimal(qty, side)?),
    ))
}

fn parse_decimal(value: &str, side: &str) -> Result<Decimal> {
    Decimal::from_str(value).with_context(|| format!("invalid decimal in {side} level: {value}"))
}
