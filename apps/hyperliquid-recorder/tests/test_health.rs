use std::time::Duration;

use hyperliquid_recorder::health::HealthState;

#[test]
fn test_health_requires_clickhouse_and_market_freshness() {
    let state = HealthState::new(vec!["BTC".to_string(), "ETH".to_string()], 30);
    assert!(!state.is_ready());

    state.set_clickhouse_ok(true);
    assert!(!state.is_ready());

    state.set_market_seen("BTC");
    state.set_market_seen("ETH");
    assert!(state.is_ready());
}

#[test]
fn test_health_becomes_unready_when_market_stale() {
    let state = HealthState::new(vec!["BTC".to_string()], 0);
    state.set_clickhouse_ok(true);
    state.set_market_seen("BTC");
    std::thread::sleep(Duration::from_millis(10));
    assert!(!state.is_ready());
}
