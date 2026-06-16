//! Hand-rolled decoder for the single Binance SBE market-data message we
//! consume: `BestBidAskStreamEvent` (templateId 10001, schemaId 1).
//!
//! We deliberately do not codegen from the SBE schema XML — we read exactly one
//! message type, so a hand-written decoder over `&[u8]` avoids a Java build step
//! and gives us direct control over forward-compatibility:
//!
//! * Unknown `templateId`s decode to `Ok(None)` (skip, don't crash) so a Binance
//!   schema bump that introduces new messages on the stream is tolerated.
//! * The var-data `symbol` is located at `headerSize + blockLength` rather than
//!   a compiled constant, so a future schema revision that *appends* fixed
//!   fields (advertised via a larger `blockLength`) still decodes correctly.
//! * Short/malformed frames return `Err` (observable), never panic.

use anyhow::{anyhow, bail, Result};

/// SBE `messageHeader` is 8 bytes: blockLength(u16), templateId(u16),
/// schemaId(u16), version(u16), all little-endian.
const HEADER_SIZE: usize = 8;

/// templateId of the `BestBidAskStreamEvent` message.
pub const TEMPLATE_ID_BEST_BID_ASK: u16 = 10001;

/// schemaId we are built against. Frames advertising a different schemaId are
/// skipped (warn + `Ok(None)`) rather than mis-decoded.
pub const EXPECTED_SCHEMA_ID: u16 = 1;

/// Size of the fixed block we read for templateId 10001. A frame may advertise a
/// `blockLength` >= this (appended fields); it must never advertise less.
const FIXED_BLOCK_LEN: usize = 50;

// Field offsets within the fixed block (after the 8-byte header).
const OFF_EVENT_TIME: usize = 0;
const OFF_BOOK_UPDATE_ID: usize = 8;
const OFF_PRICE_EXPONENT: usize = 16;
const OFF_QTY_EXPONENT: usize = 17;
const OFF_BID_PRICE: usize = 18;
const OFF_BID_QTY: usize = 26;
const OFF_ASK_PRICE: usize = 34;
const OFF_ASK_QTY: usize = 42;

/// Decoded `BestBidAskStreamEvent`. Prices/qtys are kept as raw mantissa +
/// base-10 exponent here; conversion to `Decimal` happens in `models`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BestBidAsk {
    /// Event time in microseconds since the Unix epoch.
    pub event_time_us: i64,
    pub book_update_id: i64,
    pub price_exponent: i8,
    pub qty_exponent: i8,
    pub bid_price: i64,
    pub bid_qty: i64,
    pub ask_price: i64,
    pub ask_qty: i64,
    pub symbol: String,
}

/// Decode one SBE frame.
///
/// * `Ok(Some(_))` — a `BestBidAskStreamEvent` for the expected schema.
/// * `Ok(None)` — a frame for a different templateId or schemaId (skip it).
/// * `Err(_)` — a truncated or otherwise malformed frame.
pub fn decode_message(buf: &[u8]) -> Result<Option<BestBidAsk>> {
    if buf.len() < HEADER_SIZE {
        bail!(
            "frame too short for SBE message header: {} bytes (need {HEADER_SIZE})",
            buf.len()
        );
    }

    let block_length = usize::from(read_u16(buf, 0)?);
    let template_id = read_u16(buf, 2)?;
    let schema_id = read_u16(buf, 4)?;
    let _version = read_u16(buf, 6)?;

    if template_id != TEMPLATE_ID_BEST_BID_ASK {
        return Ok(None);
    }
    if schema_id != EXPECTED_SCHEMA_ID {
        tracing::warn!(
            schema_id,
            expected = EXPECTED_SCHEMA_ID,
            "unexpected SBE schemaId for bestBidAsk; skipping frame"
        );
        return Ok(None);
    }
    if block_length < FIXED_BLOCK_LEN {
        bail!("blockLength {block_length} smaller than required fixed block {FIXED_BLOCK_LEN}");
    }

    // The fixed block lives at [HEADER_SIZE, HEADER_SIZE + block_length). We only
    // read the first FIXED_BLOCK_LEN bytes of it; any appended fields are ignored.
    let block = buf
        .get(HEADER_SIZE..HEADER_SIZE + block_length)
        .ok_or_else(|| {
            anyhow!(
                "frame truncated: need {} bytes for header + fixed block, have {}",
                HEADER_SIZE + block_length,
                buf.len()
            )
        })?;

    let event_time_us = read_i64(block, OFF_EVENT_TIME)?;
    let book_update_id = read_i64(block, OFF_BOOK_UPDATE_ID)?;
    let price_exponent = read_i8(block, OFF_PRICE_EXPONENT)?;
    let qty_exponent = read_i8(block, OFF_QTY_EXPONENT)?;
    let bid_price = read_i64(block, OFF_BID_PRICE)?;
    let bid_qty = read_i64(block, OFF_BID_QTY)?;
    let ask_price = read_i64(block, OFF_ASK_PRICE)?;
    let ask_qty = read_i64(block, OFF_ASK_QTY)?;

    // `symbol` is a varString8: a u8 length prefix followed by UTF-8 bytes,
    // located immediately after the (possibly extended) fixed block.
    let var_offset = HEADER_SIZE + block_length;
    let symbol_len = usize::from(
        *buf.get(var_offset)
            .ok_or_else(|| anyhow!("frame truncated: missing symbol length prefix"))?,
    );
    let symbol_start = var_offset + 1;
    let symbol_bytes = buf
        .get(symbol_start..symbol_start + symbol_len)
        .ok_or_else(|| {
            anyhow!("frame truncated: symbol var-data shorter than its length prefix")
        })?;
    let symbol = std::str::from_utf8(symbol_bytes)
        .map_err(|err| anyhow!("symbol var-data is not valid UTF-8: {err}"))?
        .to_string();

    Ok(Some(BestBidAsk {
        event_time_us,
        book_update_id,
        price_exponent,
        qty_exponent,
        bid_price,
        bid_qty,
        ask_price,
        ask_qty,
        symbol,
    }))
}

fn read_u16(buf: &[u8], offset: usize) -> Result<u16> {
    let slice = buf
        .get(offset..offset + 2)
        .ok_or_else(|| anyhow!("truncated u16 at offset {offset}"))?;
    let bytes: [u8; 2] = slice
        .try_into()
        .map_err(|_| anyhow!("bad u16 slice at offset {offset}"))?;
    Ok(u16::from_le_bytes(bytes))
}

fn read_i64(buf: &[u8], offset: usize) -> Result<i64> {
    let slice = buf
        .get(offset..offset + 8)
        .ok_or_else(|| anyhow!("truncated i64 at offset {offset}"))?;
    let bytes: [u8; 8] = slice
        .try_into()
        .map_err(|_| anyhow!("bad i64 slice at offset {offset}"))?;
    Ok(i64::from_le_bytes(bytes))
}

fn read_i8(buf: &[u8], offset: usize) -> Result<i8> {
    let byte = *buf
        .get(offset)
        .ok_or_else(|| anyhow!("truncated i8 at offset {offset}"))?;
    Ok(i8::from_le_bytes([byte]))
}
