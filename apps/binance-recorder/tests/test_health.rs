use std::time::Duration;

use binance_recorder::health::HealthState;

#[test]
fn test_health_requires_clickhouse_and_symbol_freshness() {
    let state = HealthState::new(vec!["XAUUSDT".to_string(), "TSLAUSDT".to_string()], 30);
    assert!(!state.is_ready());

    state.set_clickhouse_ok(true);
    assert!(
        !state.is_ready(),
        "clickhouse healthy but no symbol data yet should stay unready"
    );

    state.set_symbol_seen("XAUUSDT");
    assert!(
        !state.is_ready(),
        "one symbol still missing an update should keep state unready"
    );

    state.set_symbol_seen("TSLAUSDT");
    assert!(state.is_ready());
}

#[test]
fn test_health_becomes_unready_when_clickhouse_down() {
    let state = HealthState::new(vec!["XAUUSDT".to_string()], 30);
    state.set_clickhouse_ok(true);
    state.set_symbol_seen("XAUUSDT");
    assert!(state.is_ready());

    state.set_clickhouse_ok(false);
    assert!(
        !state.is_ready(),
        "clickhouse down should flip readiness off even with fresh symbols"
    );

    state.set_clickhouse_ok(true);
    assert!(
        state.is_ready(),
        "readiness should recover when clickhouse returns"
    );
}

#[test]
fn test_health_becomes_unready_when_symbol_stale() {
    // A zero stale window means any elapsed time makes the symbol stale.
    let state = HealthState::new(vec!["XAUUSDT".to_string()], 0);
    state.set_clickhouse_ok(true);
    state.set_symbol_seen("XAUUSDT");
    std::thread::sleep(Duration::from_millis(10));
    assert!(
        !state.is_ready(),
        "a symbol past its stale window should make state unready"
    );
}

#[test]
fn test_health_unlisted_symbol_is_stale_never_panics() {
    // An unlisted symbol never sends data, so it stays perpetually stale rather
    // than crashing the readiness check.
    let state = HealthState::new(vec!["XAUUSDT".to_string(), "NOTREAL".to_string()], 30);
    state.set_clickhouse_ok(true);
    state.set_symbol_seen("XAUUSDT");
    assert!(
        !state.is_ready(),
        "a silent/unlisted symbol should surface as staleness, not readiness"
    );
}
