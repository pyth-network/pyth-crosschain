use std::str::FromStr;

use hyperliquid_recorder::models::{L2Level, L2Snapshot};
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
