use chrono::{TimeZone, Utc};
use okx_recorder::models::{parse_frame, LaneRow, ParsedFrame};
use rust_decimal::Decimal;
use std::str::FromStr;

fn sample_bbo_frame() -> &'static str {
    r#"{
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            {
                "asks": [["111.06","55154","0","31"]],
                "bids": [["111.05","57745","0","24"]],
                "ts": "1700000000456",
                "seqId": 123456789
            }
        ]
    }"#
}

fn received_at() -> chrono::DateTime<Utc> {
    Utc.timestamp_millis_opt(1_700_000_000_999)
        .single()
        .unwrap()
}

fn parse_single_row(frame: &str) -> okx_recorder::models::BookTicker {
    match parse_frame(frame, received_at()).expect("should parse") {
        ParsedFrame::Data { rows, .. } => {
            assert_eq!(rows.len(), 1);
            let LaneRow::BookTicker(ticker) = rows.into_iter().next().unwrap();
            ticker
        }
        other => panic!("expected data frame, got {other:?}"),
    }
}

#[test]
fn parse_frame_maps_fields() {
    let ticker = parse_single_row(sample_bbo_frame());

    assert_eq!(ticker.inst_id, "OPENAI-USDT-SWAP");
    assert_eq!(ticker.seq_id, 123_456_789);
    assert_eq!(ticker.bid_px, Some(Decimal::from_str("111.05").unwrap()));
    assert_eq!(ticker.bid_qty, Some(Decimal::from_str("57745").unwrap()));
    assert_eq!(ticker.ask_px, Some(Decimal::from_str("111.06").unwrap()));
    assert_eq!(ticker.ask_qty, Some(Decimal::from_str("55154").unwrap()));
    assert_eq!(
        ticker.ts,
        Utc.timestamp_millis_opt(1_700_000_000_456)
            .single()
            .unwrap()
    );
    assert_eq!(ticker.received_at, received_at());
}

#[test]
fn parse_frame_preserves_string_decimal_precision() {
    let frame = r#"{
        "arg": { "channel": "bbo-tbt", "instId": "ANTHROPIC-USDT-SWAP" },
        "data": [
            {
                "asks": [["0.000001234567891","1.5","0","1"]],
                "bids": [["0.00000123456789","2.5","0","1"]],
                "ts": "1700000000456",
                "seqId": 1
            }
        ]
    }"#;
    let ticker = parse_single_row(frame);
    assert_eq!(
        ticker.ask_px,
        Some(Decimal::from_str("0.000001234567891").unwrap())
    );
    assert_eq!(
        ticker.bid_px,
        Some(Decimal::from_str("0.00000123456789").unwrap())
    );
}

#[test]
fn parse_frame_handles_missing_bid_side() {
    let frame = r#"{
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            {
                "asks": [["111.06","55154","0","31"]],
                "ts": "1700000000456",
                "seqId": 2
            }
        ]
    }"#;
    let ticker = parse_single_row(frame);
    assert_eq!(ticker.bid_px, None);
    assert_eq!(ticker.bid_qty, None);
    assert_eq!(ticker.ask_px, Some(Decimal::from_str("111.06").unwrap()));
}

#[test]
fn parse_frame_handles_empty_ask_side() {
    let frame = r#"{
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            {
                "asks": [],
                "bids": [["111.05","57745","0","24"]],
                "ts": "1700000000456",
                "seqId": 3
            }
        ]
    }"#;
    let ticker = parse_single_row(frame);
    assert_eq!(ticker.ask_px, None);
    assert_eq!(ticker.ask_qty, None);
    assert_eq!(ticker.bid_px, Some(Decimal::from_str("111.05").unwrap()));
}

#[test]
fn parse_frame_handles_both_sides_missing() {
    let frame = r#"{
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            { "asks": [], "bids": [], "ts": "1700000000456", "seqId": 4 }
        ]
    }"#;
    // Still a recordable row: seq_id and timestamps land even when both sides
    // are empty.
    let ticker = parse_single_row(frame);
    assert_eq!(ticker.seq_id, 4);
    assert_eq!(ticker.bid_px, None);
    assert_eq!(ticker.ask_px, None);
}

#[test]
fn parse_frame_handles_placeholder_level() {
    // Some OKX book channels emit a placeholder level of empty strings for an
    // empty side instead of an empty array; it must parse as an absent side,
    // not an error.
    let frame = r#"{
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            {
                "asks": [["","","",""]],
                "bids": [["111.05","57745","0","24"]],
                "ts": "1700000000456",
                "seqId": 8
            }
        ]
    }"#;
    let ticker = parse_single_row(frame);
    assert_eq!(ticker.ask_px, None);
    assert_eq!(ticker.ask_qty, None);
    assert_eq!(ticker.bid_px, Some(Decimal::from_str("111.05").unwrap()));
    assert_eq!(ticker.bid_qty, Some(Decimal::from_str("57745").unwrap()));
}

#[test]
fn parse_frame_handles_placeholder_levels_on_both_sides() {
    let frame = r#"{
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            {
                "asks": [["","","",""]],
                "bids": [["","","",""]],
                "ts": "1700000000456",
                "seqId": 9
            }
        ]
    }"#;
    let ticker = parse_single_row(frame);
    assert_eq!(ticker.seq_id, 9);
    assert_eq!(ticker.bid_px, None);
    assert_eq!(ticker.bid_qty, None);
    assert_eq!(ticker.ask_px, None);
    assert_eq!(ticker.ask_qty, None);
}

#[test]
fn parse_frame_handles_empty_data_array() {
    let frame = r#"{
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "data": []
    }"#;
    match parse_frame(frame, received_at()).expect("should parse") {
        ParsedFrame::Data { inst_id, rows } => {
            assert_eq!(inst_id, "OPENAI-USDT-SWAP");
            assert!(rows.is_empty());
        }
        other => panic!("expected data frame, got {other:?}"),
    }
}

#[test]
fn parse_frame_errors_on_bad_decimal() {
    let frame = r#"{
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            {
                "asks": [["not-a-number","55154","0","31"]],
                "bids": [["111.05","57745","0","24"]],
                "ts": "1700000000456",
                "seqId": 5
            }
        ]
    }"#;
    let err = parse_frame(frame, received_at()).unwrap_err();
    assert!(
        format!("{err:#}").contains("asks"),
        "error should name the side: {err:#}"
    );
}

#[test]
fn parse_frame_errors_on_truncated_level() {
    let frame = r#"{
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            {
                "asks": [["111.06"]],
                "bids": [["111.05","57745","0","24"]],
                "ts": "1700000000456",
                "seqId": 6
            }
        ]
    }"#;
    let err = parse_frame(frame, received_at()).unwrap_err();
    assert!(
        format!("{err:#}").contains("missing size"),
        "error should name the missing element: {err:#}"
    );
}

#[test]
fn parse_frame_errors_on_bad_ts() {
    let frame = r#"{
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            { "asks": [], "bids": [], "ts": "not-millis", "seqId": 7 }
        ]
    }"#;
    assert!(parse_frame(frame, received_at()).is_err());
}

#[test]
fn parse_frame_classifies_subscribe_ack() {
    let frame = r#"{
        "event": "subscribe",
        "arg": { "channel": "bbo-tbt", "instId": "OPENAI-USDT-SWAP" },
        "connId": "a4d3ae55"
    }"#;
    match parse_frame(frame, received_at()).expect("should parse") {
        ParsedFrame::Event { event, .. } => assert_eq!(event, "subscribe"),
        other => panic!("expected event frame, got {other:?}"),
    }
}

#[test]
fn parse_frame_classifies_error_event() {
    let frame = r#"{
        "event": "error",
        "code": "60012",
        "msg": "Invalid request"
    }"#;
    match parse_frame(frame, received_at()).expect("should parse") {
        ParsedFrame::Event {
            event,
            code,
            message,
        } => {
            assert_eq!(event, "error");
            assert_eq!(code.as_deref(), Some("60012"));
            assert_eq!(message.as_deref(), Some("Invalid request"));
        }
        other => panic!("expected event frame, got {other:?}"),
    }
}

#[test]
fn parse_frame_classifies_unhandled_channel() {
    let frame = r#"{
        "arg": { "channel": "trades", "instId": "OPENAI-USDT-SWAP" },
        "data": [{ "instId": "OPENAI-USDT-SWAP", "tradeId": "1", "px": "1", "sz": "1", "side": "buy", "ts": "1700000000456" }]
    }"#;
    match parse_frame(frame, received_at()).expect("should parse") {
        ParsedFrame::UnhandledChannel { channel } => assert_eq!(channel, "trades"),
        other => panic!("expected unhandled-channel frame, got {other:?}"),
    }
}

#[test]
fn parse_frame_errors_on_non_json() {
    assert!(parse_frame("pong", received_at()).is_err());
}
