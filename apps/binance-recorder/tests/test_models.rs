use std::str::FromStr;

use binance_recorder::{
    models::{scaled_decimal, BinanceBestBidAsk},
    sbe::BestBidAsk,
};
use rust_decimal::Decimal;

#[test]
fn test_scaled_decimal_negative_exponent() {
    // 1234567890 * 10^-8 = 12.3456789
    assert_eq!(
        scaled_decimal(1_234_567_890, -8),
        Decimal::from_str("12.3456789").unwrap()
    );
}

#[test]
fn test_scaled_decimal_zero_exponent() {
    assert_eq!(scaled_decimal(42, 0), Decimal::from_str("42").unwrap());
}

#[test]
fn test_scaled_decimal_positive_exponent() {
    // 42 * 10^2 = 4200
    assert_eq!(scaled_decimal(42, 2), Decimal::from_str("4200").unwrap());
}

#[test]
fn test_scaled_decimal_negative_mantissa() {
    assert_eq!(scaled_decimal(-15, -1), Decimal::from_str("-1.5").unwrap());
}

#[test]
fn test_from_sbe_builds_record() {
    let decoded = BestBidAsk {
        event_time_us: 1_700_000_000_000_000,
        book_update_id: 555,
        price_exponent: -8,
        qty_exponent: -4,
        bid_price: 1_234_567_890,
        bid_qty: 12_340_000,
        ask_price: 1_234_600_000,
        ask_qty: 56_780_000,
        symbol: "XAUUSDT".to_string(),
    };

    let record = BinanceBestBidAsk::from_sbe(&decoded, "stream-sbe.binance.com:9443");

    assert_eq!(record.symbol, "XAUUSDT");
    assert_eq!(record.event_time_us, 1_700_000_000_000_000);
    assert_eq!(record.book_update_id, 555);
    assert_eq!(record.bid_px, Decimal::from_str("12.3456789").unwrap());
    assert_eq!(record.bid_qty, Decimal::from_str("1234.0").unwrap());
    assert_eq!(record.ask_px, Decimal::from_str("12.346").unwrap());
    assert_eq!(record.ask_qty, Decimal::from_str("5678.0").unwrap());
    assert_eq!(record.source_endpoint, "stream-sbe.binance.com:9443");
}
