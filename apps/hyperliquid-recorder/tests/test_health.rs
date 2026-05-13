use std::time::{Duration, SystemTime, UNIX_EPOCH};

use hyperliquid_recorder::health::HealthState;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

#[test]
fn test_health_requires_clickhouse_and_market_freshness() {
    // Generous funding grace + threshold so the L2 readiness assertions
    // aren't perturbed by the funding gate.
    let state = HealthState::new(vec!["BTC".to_string(), "ETH".to_string()], 30, 3600, 7200);
    assert!(!state.is_ready());

    state.set_clickhouse_ok(true);
    assert!(!state.is_ready());

    state.set_market_seen("BTC");
    state.set_market_seen("ETH");
    assert!(state.is_ready());
}

#[test]
fn test_health_becomes_unready_when_market_stale() {
    let state = HealthState::new(vec!["BTC".to_string()], 0, 3600, 7200);
    state.set_clickhouse_ok(true);
    state.set_market_seen("BTC");
    std::thread::sleep(Duration::from_millis(10));
    assert!(!state.is_ready());
}

#[test]
fn test_funding_ready_within_grace_without_event() {
    // Generous grace window keeps us ready before the first event arrives.
    let state = HealthState::new(vec!["BTC".to_string()], 30, 3600, 7200);
    state.set_clickhouse_ok(true);
    state.set_market_seen("BTC");
    assert!(state.is_ready());
}

#[test]
fn test_funding_unready_past_grace_with_no_event() {
    // funding_poll_seconds = 0 ⇒ grace window = 0; we're past it immediately.
    let state = HealthState::new(vec!["BTC".to_string()], 30, 0, 7200);
    state.set_clickhouse_ok(true);
    state.set_market_seen("BTC");
    assert!(!state.is_ready());
}

#[test]
fn test_funding_ready_after_event_seen() {
    // Past grace (funding_poll_seconds = 0) but a fresh event flips us back.
    let state = HealthState::new(vec!["BTC".to_string()], 30, 0, 7200);
    state.set_clickhouse_ok(true);
    state.set_market_seen("BTC");
    state.set_funding_event_seen("BTC", now_ms());
    assert!(state.is_ready());
}

#[test]
fn test_funding_unready_when_event_older_than_threshold() {
    // funding_stale_seconds = 1 ⇒ a 10s-old event is past the threshold.
    let state = HealthState::new(vec!["BTC".to_string()], 30, 3600, 1);
    state.set_clickhouse_ok(true);
    state.set_market_seen("BTC");
    state.set_funding_event_seen("BTC", now_ms() - 10_000);
    assert!(!state.is_ready());
}
