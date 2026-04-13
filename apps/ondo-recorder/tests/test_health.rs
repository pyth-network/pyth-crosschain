use std::time::Duration;

use ondo_recorder::health::HealthState;

#[test]
fn test_health_requires_clickhouse_and_token_freshness() {
    let state = HealthState::new(vec!["AAPLon".to_string(), "NVDAon".to_string()], 30);
    assert!(!state.is_ready());

    state.set_clickhouse_ok(true);
    assert!(!state.is_ready());

    state.set_market_seen("AAPLon");
    state.set_market_seen("NVDAon");
    assert!(state.is_ready());
}

#[test]
fn test_health_becomes_unready_when_token_stale() {
    let state = HealthState::new(vec!["AAPLon".to_string()], 0);
    state.set_clickhouse_ok(true);
    state.set_market_seen("AAPLon");
    std::thread::sleep(Duration::from_millis(10));
    assert!(!state.is_ready());
}
