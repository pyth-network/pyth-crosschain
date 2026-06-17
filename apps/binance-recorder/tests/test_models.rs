use binance_recorder::models::BookTicker;
use binance_sdk::spot::websocket_streams::BookTickerResponse;
use chrono::{TimeZone, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;

fn sample_response() -> BookTickerResponse {
    BookTickerResponse {
        u: Some(400900217),
        s: Some("BTCUSDT".to_string()),
        b: Some("25.35190000".to_string()),
        b_uppercase: Some("31.21000000".to_string()),
        a: Some("25.36520000".to_string()),
        a_uppercase: Some("40.66000000".to_string()),
    }
}

#[test]
fn from_sdk_maps_fields() {
    let received_at = Utc
        .timestamp_millis_opt(1_700_000_000_123)
        .single()
        .unwrap();
    let ticker = BookTicker::from_sdk(sample_response(), received_at).expect("should parse");

    assert_eq!(ticker.symbol, "BTCUSDT");
    assert_eq!(ticker.update_id, 400_900_217);
    assert_eq!(ticker.bid_px, Decimal::from_str("25.35190000").unwrap());
    assert_eq!(ticker.bid_qty, Decimal::from_str("31.21000000").unwrap());
    assert_eq!(ticker.ask_px, Decimal::from_str("25.36520000").unwrap());
    assert_eq!(ticker.ask_qty, Decimal::from_str("40.66000000").unwrap());
    assert_eq!(ticker.received_at, received_at);
}

#[test]
fn from_sdk_errors_on_bad_decimal() {
    let mut resp = sample_response();
    resp.b = Some("not-a-number".to_string());
    let err = BookTicker::from_sdk(resp, Utc::now()).unwrap_err();
    assert!(
        err.to_string().contains('b'),
        "error should name the field: {err}"
    );
}

#[test]
fn from_sdk_errors_on_missing_update_id() {
    let mut resp = sample_response();
    resp.u = None;
    assert!(BookTicker::from_sdk(resp, Utc::now()).is_err());
}

#[test]
fn from_sdk_errors_on_missing_symbol() {
    let mut resp = sample_response();
    resp.s = None;
    assert!(BookTicker::from_sdk(resp, Utc::now()).is_err());
}

#[test]
fn from_sdk_errors_on_negative_update_id() {
    let mut resp = sample_response();
    resp.u = Some(-1);
    assert!(BookTicker::from_sdk(resp, Utc::now()).is_err());
}

#[test]
fn dedupe_key_is_symbol_and_update_id() {
    let ticker = BookTicker::from_sdk(sample_response(), Utc::now()).unwrap();
    assert_eq!(ticker.dedupe_key(), ("BTCUSDT".to_string(), 400_900_217));
}
