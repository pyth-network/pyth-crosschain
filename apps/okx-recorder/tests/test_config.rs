use okx_recorder::config::AppConfig;
use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

static ENV_LOCK: Mutex<()> = Mutex::new(());

const ENV_KEYS: [&str; 14] = [
    "OKX_RECORDER__INSTRUMENTS",
    "OKX_RECORDER__WS_URL",
    "OKX_RECORDER__CLICKHOUSE__URL",
    "OKX_RECORDER__CLICKHOUSE__USER",
    "OKX_RECORDER__CLICKHOUSE__PASSWORD",
    "OKX_RECORDER__CLICKHOUSE__DATABASE",
    "OKX_RECORDER__CLICKHOUSE__BOOK_TICKER_TABLE",
    "OKX_RECORDER__CLICKHOUSE__TRADES_TABLE",
    "OKX_RECORDER__CLICKHOUSE__FUNDING_RATES_TABLE",
    "OKX_RECORDER__METRICS_PORT",
    "OKX_RECORDER__HEALTH_PORT",
    "OKX_RECORDER__FUNDING_HISTORY_URL",
    "OKX_RECORDER__FUNDING_POLL_SECONDS",
    "OKX_RECORDER__FUNDING_HISTORY_LIMIT",
];

#[test]
fn test_config_parses_yaml_file() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("okx-config");
    let yaml = r#"
instruments:
  - "OPENAI-USDT-SWAP"
  - "ANTHROPIC-USDT-SWAP"
ws_url: "wss://ws.okx.com:8443/ws/v5/public"
clickhouse:
  url: "http://127.0.0.1:8123"
  user: "recorder"
  password: "recorder"
  database: "default"
  book_ticker_table: "okx_book_ticker"
  trades_table: "okx_trades_custom"
metrics_port: 9095
health_port: 8085
batch_max_rows: 5000
batch_flush_seconds: 1.5
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config = AppConfig::from_sources(Some(&config_file)).expect("yaml config should parse");

    assert_eq!(
        config.instruments,
        vec!["OPENAI-USDT-SWAP", "ANTHROPIC-USDT-SWAP"]
    );
    assert_eq!(config.ws_url, "wss://ws.okx.com:8443/ws/v5/public");
    assert_eq!(config.metrics_port, 9095);
    assert_eq!(config.health_port, 8085);
    assert_eq!(config.batch_max_rows, 5000);
    assert_eq!(config.batch_flush_seconds, 1.5);
    assert_eq!(config.clickhouse.host, "127.0.0.1");
    assert_eq!(config.clickhouse.port, 8123);
    assert!(!config.clickhouse.secure);
    assert_eq!(config.clickhouse.book_ticker_table, "okx_book_ticker");
    assert_eq!(config.clickhouse.trades_table, "okx_trades_custom");

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_defaults_applied_when_absent() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    // Only the required ClickHouse URL is supplied; everything else defaults.
    let config_file = temp_yaml_path("okx-config-defaults");
    let yaml = r#"
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config = AppConfig::from_sources(Some(&config_file)).expect("config should parse");

    // The seeded instruments from the spec.
    assert_eq!(
        config.instruments,
        vec!["OPENAI-USDT-SWAP", "ANTHROPIC-USDT-SWAP"]
    );
    assert_eq!(config.ws_url, "wss://ws.okx.com:8443/ws/v5/public");
    assert_eq!(config.queue_max_rows, 50_000);
    assert_eq!(config.batch_max_rows, 10_000);
    assert_eq!(config.batch_flush_seconds, 2.0);
    assert_eq!(config.ready_stale_seconds, 10);
    assert_eq!(config.reconnect_max_backoff_seconds, 30);
    assert!(config.insert_async);
    // ClickHouse target falls back to the default user/database/tables.
    assert_eq!(config.clickhouse.username, "default");
    assert_eq!(config.clickhouse.database, "default");
    assert_eq!(config.clickhouse.book_ticker_table, "okx_book_ticker");
    assert_eq!(config.clickhouse.trades_table, "okx_trades");
    assert_eq!(config.clickhouse.funding_rates_table, "okx_funding_rates");
    // Funding lane defaults: the public history endpoint on a 5-minute poll.
    assert_eq!(
        config.funding_history_url,
        "https://www.okx.com/api/v5/public/funding-rate-history"
    );
    assert_eq!(config.funding_poll_seconds, 300);
    assert_eq!(config.funding_history_limit, 10);

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_env_overrides_yaml_values() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("okx-config-overrides");
    let yaml = r#"
instruments:
  - "OPENAI-USDT-SWAP"
clickhouse:
  url: "http://127.0.0.1:8123"
metrics_port: 9095
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    std::env::set_var("OKX_RECORDER__METRICS_PORT", "9191");

    let config = AppConfig::from_sources(Some(&config_file)).expect("config should parse");
    assert_eq!(config.metrics_port, 9191);

    clear_env_vars(["OKX_RECORDER__METRICS_PORT"]);
    let _ = fs::remove_file(config_file);
}

#[test]
fn test_instruments_normalized_to_uppercase() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("okx-config-case");
    let yaml = r#"
instruments:
  - "openai-usdt-swap"
  - "Anthropic-Usdt-Swap"
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config = AppConfig::from_sources(Some(&config_file)).expect("config should parse");
    assert_eq!(
        config.instruments,
        vec!["OPENAI-USDT-SWAP", "ANTHROPIC-USDT-SWAP"]
    );

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_empty_instruments_list_rejected() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("okx-config-empty-instruments");
    let yaml = r#"
instruments: []
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "empty instruments list should fail");
    let message = result.err().map(|err| err.to_string()).unwrap_or_default();
    assert!(
        message.contains("at least one instrument"),
        "unexpected error: {message}"
    );

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_clickhouse_url_parses_secure_target() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("okx-config-secure");
    let yaml = r#"
instruments:
  - "OPENAI-USDT-SWAP"
clickhouse:
  url: "https://clickhouse.internal:9440"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config = AppConfig::from_sources(Some(&config_file)).expect("config should parse");
    assert_eq!(config.clickhouse.host, "clickhouse.internal");
    assert_eq!(config.clickhouse.port, 9440);
    assert!(config.clickhouse.secure);

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_missing_clickhouse_url_fails() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("okx-config-no-ch");
    let yaml = r#"
instruments:
  - "OPENAI-USDT-SWAP"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "missing ClickHouse URL should fail");

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_funding_poll_seconds_below_minute_rejected() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("okx-config-funding-poll");
    let yaml = r#"
clickhouse:
  url: "http://127.0.0.1:8123"
funding_poll_seconds: 5
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "sub-minute funding poll should fail");
    let message = result.err().map(|err| err.to_string()).unwrap_or_default();
    assert!(
        message.contains("funding_poll_seconds"),
        "unexpected error: {message}"
    );

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_funding_history_limit_out_of_range_rejected() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    // OKX caps the history `limit` query parameter at 100.
    for bad_limit in ["0", "101"] {
        let config_file = temp_yaml_path("okx-config-funding-limit");
        let yaml = format!(
            r#"
clickhouse:
  url: "http://127.0.0.1:8123"
funding_history_limit: {bad_limit}
"#
        );
        fs::write(&config_file, yaml).expect("write yaml config");
        let result = AppConfig::from_sources(Some(&config_file));
        assert!(
            result.is_err(),
            "funding_history_limit {bad_limit} should fail"
        );
        let message = result.err().map(|err| err.to_string()).unwrap_or_default();
        assert!(
            message.contains("funding_history_limit"),
            "unexpected error: {message}"
        );

        let _ = fs::remove_file(config_file);
    }
}

fn clear_env_vars<'a>(keys: impl IntoIterator<Item = &'a str>) {
    for key in keys {
        std::env::remove_var(key);
    }
}

fn temp_yaml_path(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock drift")
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}-{nanos}.yaml"))
}
