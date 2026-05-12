use std::str::FromStr;

use hyperliquid_recorder::models::{
    parse_funding_history, FundingRateRecord, L2Level, L2Snapshot,
};
use rust_decimal::Decimal;

#[test]
fn test_snapshot_dedupe_key_uses_request_shape() {
    let snapshot = L2Snapshot {
        coin: "BTC".to_string(),
        block_time_ms: 1_700_000_000_000,
        block_number: 123,
        n_levels: 20,
        n_sig_figs: Some(3),
        mantissa: Some(1),
        source_endpoint: "endpoint".to_string(),
        bids: vec![L2Level {
            px: Decimal::from_str("1.0").expect("valid decimal"),
            sz: Decimal::from_str("2.0").expect("valid decimal"),
            n: 1,
        }],
        asks: vec![L2Level {
            px: Decimal::from_str("1.1").expect("valid decimal"),
            sz: Decimal::from_str("3.0").expect("valid decimal"),
            n: 2,
        }],
    };
    assert_eq!(snapshot.dedupe_key(), ("BTC".to_string(), 123, 20, 3, 1));
}

#[test]
fn test_funding_dedupe_key_is_coin_and_time() {
    let record = FundingRateRecord {
        coin: "BTC".to_string(),
        funding_time_ms: 1_700_000_000_000,
        funding_rate: Decimal::from_str("0.0000125").expect("valid decimal"),
        premium: Some(Decimal::from_str("0.00001").expect("valid decimal")),
        source_endpoint: "https://api.hyperliquid.xyz/info".to_string(),
    };
    assert_eq!(
        record.dedupe_key(),
        ("BTC".to_string(), 1_700_000_000_000)
    );
}

#[test]
fn test_parse_funding_history_canonical_payload() {
    let body = r#"[
        {"coin": "BTC", "fundingRate": "0.0000125", "premium": "0.00001", "time": 1700000000000},
        {"coin": "BTC", "fundingRate": "0.0000130", "premium": "0.00002", "time": 1700003600000}
    ]"#;
    let records = parse_funding_history(body, "BTC", "https://api.hyperliquid.xyz/info")
        .expect("payload should parse");
    assert_eq!(records.len(), 2);
    assert_eq!(records[0].coin, "BTC");
    assert_eq!(records[0].funding_time_ms, 1_700_000_000_000);
    assert_eq!(
        records[0].funding_rate,
        Decimal::from_str("0.0000125").unwrap()
    );
    assert_eq!(
        records[0].premium,
        Some(Decimal::from_str("0.00001").unwrap())
    );
    assert_eq!(
        records[0].source_endpoint,
        "https://api.hyperliquid.xyz/info"
    );
    assert_eq!(records[1].funding_time_ms, 1_700_003_600_000);
}

#[test]
fn test_parse_funding_history_empty_array_is_ok() {
    let records =
        parse_funding_history("[]", "BTC", "src").expect("empty array should parse");
    assert!(records.is_empty());
}

#[test]
fn test_parse_funding_history_missing_premium_is_none() {
    let body = r#"[
        {"coin": "BTC", "fundingRate": "0.00002", "time": 1700000000000}
    ]"#;
    let records = parse_funding_history(body, "BTC", "src").expect("payload should parse");
    assert_eq!(records.len(), 1);
    assert!(records[0].premium.is_none());
}

#[test]
fn test_parse_funding_history_malformed_decimal_errors() {
    let body = r#"[
        {"coin": "BTC", "fundingRate": "not-a-number", "time": 1700000000000}
    ]"#;
    let result = parse_funding_history(body, "BTC", "src");
    assert!(result.is_err(), "malformed decimal must error");
}

#[test]
fn test_parse_funding_history_drops_coin_mismatch() {
    let body = r#"[
        {"coin": "BTC", "fundingRate": "0.0000125", "time": 1700000000000},
        {"coin": "btc", "fundingRate": "0.0000130", "time": 1700003600000}
    ]"#;
    let records =
        parse_funding_history(body, "BTC", "src").expect("payload should parse");
    assert_eq!(records.len(), 1, "lowercase coin should be dropped, not errored");
    assert_eq!(records[0].coin, "BTC");
}
