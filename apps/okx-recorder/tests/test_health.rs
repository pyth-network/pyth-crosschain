use std::time::Duration;

use okx_recorder::health::HealthState;

#[test]
fn test_health_requires_clickhouse_and_instrument_freshness() {
    let state = HealthState::new(
        vec![
            "OPENAI-USDT-SWAP".to_string(),
            "ANTHROPIC-USDT-SWAP".to_string(),
        ],
        30,
    );
    assert!(!state.is_ready());

    state.set_clickhouse_ok(true);
    assert!(
        !state.is_ready(),
        "clickhouse healthy but no instrument data yet should stay unready"
    );

    state.set_instrument_seen("OPENAI-USDT-SWAP");
    assert!(
        !state.is_ready(),
        "one instrument still missing an update should keep state unready"
    );

    state.set_instrument_seen("ANTHROPIC-USDT-SWAP");
    assert!(state.is_ready());
}

#[test]
fn test_health_becomes_unready_when_clickhouse_down() {
    let state = HealthState::new(vec!["OPENAI-USDT-SWAP".to_string()], 30);
    state.set_clickhouse_ok(true);
    state.set_instrument_seen("OPENAI-USDT-SWAP");
    assert!(state.is_ready());

    state.set_clickhouse_ok(false);
    assert!(
        !state.is_ready(),
        "clickhouse down should flip readiness off even with fresh instruments"
    );

    state.set_clickhouse_ok(true);
    assert!(
        state.is_ready(),
        "readiness should recover when clickhouse returns"
    );
}

#[test]
fn test_health_becomes_unready_when_instrument_stale() {
    // A zero stale window means any elapsed time makes the instrument stale.
    let state = HealthState::new(vec!["OPENAI-USDT-SWAP".to_string()], 0);
    state.set_clickhouse_ok(true);
    state.set_instrument_seen("OPENAI-USDT-SWAP");
    std::thread::sleep(Duration::from_millis(10));
    assert!(
        !state.is_ready(),
        "an instrument past its stale window should make state unready"
    );
}

#[test]
fn test_health_unlisted_instrument_is_stale_never_panics() {
    // An unlisted instrument never sends data, so it stays perpetually stale
    // rather than crashing the readiness check.
    let state = HealthState::new(
        vec![
            "OPENAI-USDT-SWAP".to_string(),
            "NOTREAL-USDT-SWAP".to_string(),
        ],
        30,
    );
    state.set_clickhouse_ok(true);
    state.set_instrument_seen("OPENAI-USDT-SWAP");
    assert!(
        !state.is_ready(),
        "a silent/unlisted instrument should surface as staleness, not readiness"
    );
}
