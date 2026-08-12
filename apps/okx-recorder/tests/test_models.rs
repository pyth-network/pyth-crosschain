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
            match rows.into_iter().next().unwrap() {
                LaneRow::BookTicker(ticker) => ticker,
                other => panic!("expected book ticker row, got {other:?}"),
            }
        }
        other => panic!("expected data frame, got {other:?}"),
    }
}

fn parse_trade_rows(frame: &str) -> Vec<okx_recorder::models::Trade> {
    match parse_frame(frame, received_at()).expect("should parse") {
        ParsedFrame::Data { rows, .. } => rows
            .into_iter()
            .map(|row| match row {
                LaneRow::Trade(trade) => trade,
                other => panic!("expected trade row, got {other:?}"),
            })
            .collect(),
        other => panic!("expected data frame, got {other:?}"),
    }
}

fn parse_single_trade(frame: &str) -> okx_recorder::models::Trade {
    let mut trades = parse_trade_rows(frame);
    assert_eq!(trades.len(), 1);
    trades.remove(0)
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
        "arg": { "channel": "mark-price", "instId": "OPENAI-USDT-SWAP" },
        "data": [{ "instId": "OPENAI-USDT-SWAP", "markPx": "111.05", "ts": "1700000000456" }]
    }"#;
    match parse_frame(frame, received_at()).expect("should parse") {
        ParsedFrame::UnhandledChannel { channel } => assert_eq!(channel, "mark-price"),
        other => panic!("expected unhandled-channel frame, got {other:?}"),
    }
}

#[test]
fn parse_trades_frame_maps_fields() {
    let frame = r#"{
        "arg": { "channel": "trades", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            {
                "instId": "OPENAI-USDT-SWAP",
                "tradeId": "130639474",
                "px": "111.05",
                "sz": "0.12060306",
                "side": "buy",
                "count": "1",
                "ts": "1700000000456"
            }
        ]
    }"#;
    let trade = parse_single_trade(frame);

    assert_eq!(trade.inst_id, "OPENAI-USDT-SWAP");
    assert_eq!(trade.trade_id, "130639474");
    assert_eq!(trade.px, Decimal::from_str("111.05").unwrap());
    assert_eq!(trade.sz, Decimal::from_str("0.12060306").unwrap());
    assert_eq!(trade.side, "buy");
    assert_eq!(trade.count, 1);
    assert_eq!(
        trade.ts,
        Utc.timestamp_millis_opt(1_700_000_000_456)
            .single()
            .unwrap()
    );
    assert_eq!(trade.received_at, received_at());
}

#[test]
fn parse_trades_frame_keeps_aggregate_count() {
    // OKX aggregates fills at the same px/ts into one print; `count` > 1 marks
    // an aggregate print and must survive parsing.
    let frame = r#"{
        "arg": { "channel": "trades", "instId": "ANTHROPIC-USDT-SWAP" },
        "data": [
            {
                "instId": "ANTHROPIC-USDT-SWAP",
                "tradeId": "130639480",
                "px": "22.5",
                "sz": "3.75",
                "side": "sell",
                "count": "7",
                "ts": "1700000000456"
            }
        ]
    }"#;
    let trade = parse_single_trade(frame);
    assert_eq!(trade.count, 7);
    assert_eq!(trade.side, "sell");
}

#[test]
fn parse_trades_frame_defaults_missing_count_to_one() {
    // Non-aggregating variants of the channel omit `count`; a print without it
    // is a single fill.
    let frame = r#"{
        "arg": { "channel": "trades", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            {
                "instId": "OPENAI-USDT-SWAP",
                "tradeId": "130639475",
                "px": "111.06",
                "sz": "1",
                "side": "buy",
                "ts": "1700000000456"
            }
        ]
    }"#;
    let trade = parse_single_trade(frame);
    assert_eq!(trade.count, 1);
}

#[test]
fn parse_trades_frame_preserves_string_decimal_precision() {
    let frame = r#"{
        "arg": { "channel": "trades", "instId": "ANTHROPIC-USDT-SWAP" },
        "data": [
            {
                "instId": "ANTHROPIC-USDT-SWAP",
                "tradeId": "1",
                "px": "0.000001234567891",
                "sz": "123456789.000000000001",
                "side": "buy",
                "count": "1",
                "ts": "1700000000456"
            }
        ]
    }"#;
    let trade = parse_single_trade(frame);
    assert_eq!(trade.px, Decimal::from_str("0.000001234567891").unwrap());
    assert_eq!(
        trade.sz,
        Decimal::from_str("123456789.000000000001").unwrap()
    );
}

#[test]
fn parse_trades_frame_handles_multiple_prints() {
    let frame = r#"{
        "arg": { "channel": "trades", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            { "tradeId": "10", "px": "111.05", "sz": "1", "side": "buy", "count": "1", "ts": "1700000000456" },
            { "tradeId": "11", "px": "111.06", "sz": "2", "side": "sell", "count": "3", "ts": "1700000000457" }
        ]
    }"#;
    let trades = parse_trade_rows(frame);
    assert_eq!(trades.len(), 2);
    assert_eq!(trades[0].trade_id, "10");
    assert_eq!(trades[1].trade_id, "11");
    assert_eq!(trades[1].count, 3);
}

#[test]
fn parse_trades_frame_handles_empty_data_array() {
    let frame = r#"{
        "arg": { "channel": "trades", "instId": "OPENAI-USDT-SWAP" },
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
fn parse_trades_frame_errors_on_bad_decimal() {
    let frame = r#"{
        "arg": { "channel": "trades", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            { "tradeId": "1", "px": "not-a-number", "sz": "1", "side": "buy", "count": "1", "ts": "1700000000456" }
        ]
    }"#;
    let err = parse_frame(frame, received_at()).unwrap_err();
    assert!(
        format!("{err:#}").contains("px"),
        "error should name the field: {err:#}"
    );
}

#[test]
fn parse_trades_frame_errors_on_bad_count() {
    let frame = r#"{
        "arg": { "channel": "trades", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            { "tradeId": "1", "px": "111.05", "sz": "1", "side": "buy", "count": "many", "ts": "1700000000456" }
        ]
    }"#;
    let err = parse_frame(frame, received_at()).unwrap_err();
    assert!(
        format!("{err:#}").contains("count"),
        "error should name the field: {err:#}"
    );
}

#[test]
fn parse_trades_frame_errors_on_bad_ts() {
    let frame = r#"{
        "arg": { "channel": "trades", "instId": "OPENAI-USDT-SWAP" },
        "data": [
            { "tradeId": "1", "px": "111.05", "sz": "1", "side": "buy", "count": "1", "ts": "not-millis" }
        ]
    }"#;
    assert!(parse_frame(frame, received_at()).is_err());
}

#[test]
fn parse_frame_errors_on_non_json() {
    assert!(parse_frame("pong", received_at()).is_err());
}
