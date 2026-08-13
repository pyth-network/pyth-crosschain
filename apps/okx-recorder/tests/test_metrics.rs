use okx_recorder::metrics::RecorderMetrics;

fn payload_string(metrics: &RecorderMetrics) -> String {
    String::from_utf8(metrics.to_prometheus_payload().expect("encode payload"))
        .expect("payload is utf-8")
}

#[test]
fn init_instruments_creates_series_for_every_configured_instrument() {
    let metrics = RecorderMetrics::new().expect("metrics");
    let instruments = vec![
        "OPENAI-USDT-SWAP".to_string(),
        "ANTHROPIC-USDT-SWAP".to_string(),
    ];

    metrics.init_instruments(&instruments);

    // Every configured instrument exposes a last-seen series before any data
    // arrives, so age-based staleness alerts can fire for an instrument that
    // never streams.
    let payload = payload_string(&metrics);
    for inst_id in &instruments {
        assert!(
            payload.contains(&format!(
                "okx_recorder_tob_last_seen_unix_seconds{{inst_id=\"{inst_id}\"}}"
            )),
            "expected pre-initialized series for {inst_id} in payload:\n{payload}"
        );
    }
}

#[test]
fn init_instruments_seeds_gauge_with_startup_time() {
    let metrics = RecorderMetrics::new().expect("metrics");
    let instruments = vec!["OPENAI-USDT-SWAP".to_string()];
    let before = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs_f64();

    metrics.init_instruments(&instruments);

    let after = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs_f64();
    let value = metrics
        .tob_last_seen_unix_seconds
        .with_label_values(&["OPENAI-USDT-SWAP"])
        .get();
    assert!(
        (before..=after).contains(&value),
        "seeded value {value} should be the startup timestamp (between {before} and {after})"
    );
}

#[test]
fn record_tob_seen_overwrites_seeded_value() {
    let metrics = RecorderMetrics::new().expect("metrics");
    let instruments = vec!["OPENAI-USDT-SWAP".to_string()];
    metrics.init_instruments(&instruments);
    let seeded = metrics
        .tob_last_seen_unix_seconds
        .with_label_values(&["OPENAI-USDT-SWAP"])
        .get();

    metrics.record_tob_seen("OPENAI-USDT-SWAP");

    let updated = metrics
        .tob_last_seen_unix_seconds
        .with_label_values(&["OPENAI-USDT-SWAP"])
        .get();
    assert!(
        updated >= seeded,
        "a real update ({updated}) must never move the gauge before the seed ({seeded})"
    );
}
