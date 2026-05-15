use std::time::Duration;

use ondo_recorder::health::{HealthState, Market};

#[test]
fn test_health_requires_clickhouse_and_market_freshness() {
    let state = HealthState::new(
        vec![
            Market::new("AAPLon", "ethereum-1"),
            Market::new("NVDAon", "ethereum-1"),
        ],
        30,
    );
    assert!(!state.is_ready());

    state.set_clickhouse_ok(true);
    assert!(!state.is_ready());

    state.set_market_seen("AAPLon", "ethereum-1");
    state.set_market_seen("NVDAon", "ethereum-1");
    assert!(state.is_ready());
}

#[test]
fn test_health_tracks_same_symbol_across_chains_independently() {
    let state = HealthState::new(
        vec![
            Market::new("AAPLon", "ethereum-1"),
            Market::new("AAPLon", "bsc-56"),
        ],
        30,
    );
    state.set_clickhouse_ok(true);
    state.set_market_seen("AAPLon", "ethereum-1");
    assert!(
        !state.is_ready(),
        "one chain still missing a poll should keep state unready"
    );
    state.set_market_seen("AAPLon", "bsc-56");
    assert!(state.is_ready());
}

#[test]
fn test_health_becomes_unready_when_market_stale() {
    let state = HealthState::new(vec![Market::new("AAPLon", "ethereum-1")], 0);
    state.set_clickhouse_ok(true);
    state.set_market_seen("AAPLon", "ethereum-1");
    std::thread::sleep(Duration::from_millis(10));
    assert!(!state.is_ready());
}
