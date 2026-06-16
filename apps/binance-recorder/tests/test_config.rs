use binance_recorder::config::AppConfig;
use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

static ENV_LOCK: Mutex<()> = Mutex::new(());

const ENV_KEYS: [&str; 10] = [
    "BINANCE_RECORDER__BINANCE__ENDPOINT",
    "BINANCE_RECORDER__BINANCE__API_KEY",
    "BINANCE_RECORDER__SYMBOLS",
    "BINANCE_RECORDER__CLICKHOUSE__URL",
    "BINANCE_RECORDER__CLICKHOUSE__USER",
    "BINANCE_RECORDER__CLICKHOUSE__PASSWORD",
    "BINANCE_RECORDER__CLICKHOUSE__DATABASE",
    "BINANCE_RECORDER__CLICKHOUSE__BEST_BID_ASK_TABLE",
    "BINANCE_RECORDER__METRICS_PORT",
    "BINANCE_RECORDER__WS_RECYCLE_SECONDS",
];

#[test]
fn test_config_parses_yaml_file() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("brec-config");
    let yaml = r#"
binance:
  endpoint: "stream-sbe.binance.com:9443"
  api_key: "yaml-key"
symbols:
  - "XAUUSDT"
  - "  nvdausdt  "
clickhouse:
  url: "http://127.0.0.1:8123"
  user: "recorder"
  password: "recorder"
  database: "pyth_analytics"
  best_bid_ask_table: "binance_best_bid_ask"
metrics_port: 9092
health_port: 8082
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config = AppConfig::from_sources(Some(&config_file)).expect("yaml config should parse");

    assert_eq!(config.binance_endpoint, "stream-sbe.binance.com:9443");
    assert_eq!(config.binance_api_key, "yaml-key");
    // Symbols are trimmed and lowercased.
    assert_eq!(config.symbols, vec!["xauusdt", "nvdausdt"]);
    assert_eq!(config.metrics_port, 9092);
    assert_eq!(config.health_port, 8082);
    assert_eq!(config.clickhouse.host, "127.0.0.1");
    assert_eq!(config.clickhouse.port, 8123);
    assert_eq!(config.clickhouse.best_bid_ask_table, "binance_best_bid_ask");

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_env_overrides_yaml_values() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("brec-config-overrides");
    let yaml = r#"
binance:
  endpoint: "stream-sbe.binance.com:9443"
  api_key: "yaml-key"
symbols:
  - "xauusdt"
clickhouse:
  url: "http://127.0.0.1:8123"
metrics_port: 9092
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    std::env::set_var("BINANCE_RECORDER__BINANCE__API_KEY", "env-key");
    std::env::set_var("BINANCE_RECORDER__METRICS_PORT", "9191");

    let config = AppConfig::from_sources(Some(&config_file)).expect("config should parse");
    assert_eq!(config.binance_api_key, "env-key");
    assert_eq!(config.metrics_port, 9191);

    clear_env_vars(ENV_KEYS);
    let _ = fs::remove_file(config_file);
}

#[test]
fn test_defaults_applied_when_unspecified() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("brec-config-defaults");
    let yaml = r#"
binance:
  api_key: "yaml-key"
symbols:
  - "xauusdt"
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config =
        AppConfig::from_sources(Some(&config_file)).expect("config should parse with defaults");

    assert_eq!(config.binance_endpoint, "stream-sbe.binance.com:9443");
    assert_eq!(config.metrics_port, 9092);
    assert_eq!(config.health_port, 8082);
    assert_eq!(config.ready_stale_seconds, 30);
    assert_eq!(config.queue_max_rows, 50_000);
    assert_eq!(config.batch_max_rows, 10_000);
    assert_eq!(config.retention_days, 90);
    assert!(config.insert_async);
    assert_eq!(config.reconnect_max_backoff_seconds, 60);
    assert_eq!(config.ws_recycle_seconds, 82_800);
    assert_eq!(config.clickhouse.database, "pyth_analytics");
    assert_eq!(config.clickhouse.best_bid_ask_table, "binance_best_bid_ask");
    assert_eq!(config.clickhouse.username, "default");

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_missing_symbols_rejected() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("brec-config-missing-symbols");
    let yaml = r#"
binance:
  api_key: "yaml-key"
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "missing symbols must be rejected");
    let message = result.err().map(|e| e.to_string()).unwrap_or_default();
    assert!(
        message.contains("at least one symbol is required"),
        "unexpected error: {message}"
    );

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_empty_symbols_list_rejected() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("brec-config-empty-symbols");
    let yaml = r#"
binance:
  api_key: "yaml-key"
symbols: []
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "empty symbols list must be rejected");
    let message = result.err().map(|e| e.to_string()).unwrap_or_default();
    assert!(
        message.contains("at least one symbol is required"),
        "unexpected error: {message}"
    );

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_missing_api_key_rejected() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("brec-config-missing-key");
    let yaml = r#"
symbols:
  - "xauusdt"
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "missing api_key must be rejected");
    let message = result.err().map(|e| e.to_string()).unwrap_or_default();
    assert!(message.contains("API_KEY"), "unexpected error: {message}");

    let _ = fs::remove_file(config_file);
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
