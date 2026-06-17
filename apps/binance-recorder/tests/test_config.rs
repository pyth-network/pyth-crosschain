use binance_recorder::config::AppConfig;
use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

static ENV_LOCK: Mutex<()> = Mutex::new(());

const ENV_KEYS: [&str; 8] = [
    "BINANCE_RECORDER__MARKETS",
    "BINANCE_RECORDER__CLICKHOUSE__URL",
    "BINANCE_RECORDER__CLICKHOUSE__USER",
    "BINANCE_RECORDER__CLICKHOUSE__PASSWORD",
    "BINANCE_RECORDER__CLICKHOUSE__DATABASE",
    "BINANCE_RECORDER__CLICKHOUSE__TABLE",
    "BINANCE_RECORDER__METRICS_PORT",
    "BINANCE_RECORDER__HEALTH_PORT",
];

#[test]
fn test_config_parses_yaml_file() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("binance-config");
    let yaml = r#"
markets:
  - "XAUUSDT"
  - "NVDAUSDT"
  - "TSLAUSDT"
clickhouse:
  url: "http://127.0.0.1:8123"
  user: "recorder"
  password: "recorder"
  database: "pyth_analytics"
  table: "binance_book_ticker"
metrics_port: 9094
health_port: 8084
batch_max_rows: 5000
batch_flush_seconds: 1.5
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config = AppConfig::from_sources(Some(&config_file)).expect("yaml config should parse");

    assert_eq!(config.markets, vec!["XAUUSDT", "NVDAUSDT", "TSLAUSDT"]);
    assert_eq!(config.metrics_port, 9094);
    assert_eq!(config.health_port, 8084);
    assert_eq!(config.batch_max_rows, 5000);
    assert_eq!(config.batch_flush_seconds, 1.5);
    assert_eq!(config.clickhouse.host, "127.0.0.1");
    assert_eq!(config.clickhouse.port, 8123);
    assert!(!config.clickhouse.secure);
    assert_eq!(config.clickhouse.table, "binance_book_ticker");

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_defaults_applied_when_absent() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    // Only the required ClickHouse URL is supplied; everything else defaults.
    let config_file = temp_yaml_path("binance-config-defaults");
    let yaml = r#"
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config = AppConfig::from_sources(Some(&config_file)).expect("config should parse");

    // The seeded index basket from the spec.
    assert_eq!(
        config.markets,
        vec![
            "XAUUSDT", "XAGUSDT", "CLUSDT", "BZUSDT", "CRCLUSDT", "MSTRUSDT", "NVDAUSDT",
            "TSLAUSDT", "SPCXUSDT",
        ]
    );
    assert_eq!(config.queue_max_rows, 50_000);
    assert_eq!(config.batch_max_rows, 10_000);
    assert_eq!(config.batch_flush_seconds, 2.0);
    assert_eq!(config.ready_stale_seconds, 10);
    assert_eq!(config.reconnect_max_backoff_seconds, 5);
    assert!(config.insert_async);
    // ClickHouse target falls back to the default user/database/table.
    assert_eq!(config.clickhouse.username, "default");
    assert_eq!(config.clickhouse.database, "pyth_analytics");
    assert_eq!(config.clickhouse.table, "binance_book_ticker");

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_env_overrides_yaml_values() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("binance-config-overrides");
    let yaml = r#"
markets:
  - "XAUUSDT"
clickhouse:
  url: "http://127.0.0.1:8123"
metrics_port: 9094
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    std::env::set_var("BINANCE_RECORDER__METRICS_PORT", "9191");

    let config = AppConfig::from_sources(Some(&config_file)).expect("config should parse");
    assert_eq!(config.metrics_port, 9191);

    clear_env_vars(["BINANCE_RECORDER__METRICS_PORT"]);
    let _ = fs::remove_file(config_file);
}

#[test]
fn test_markets_normalized_to_uppercase() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("binance-config-case");
    let yaml = r#"
markets:
  - "xauusdt"
  - "Nvdausdt"
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config = AppConfig::from_sources(Some(&config_file)).expect("config should parse");
    assert_eq!(config.markets, vec!["XAUUSDT", "NVDAUSDT"]);

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_empty_markets_list_rejected() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("binance-config-empty-markets");
    let yaml = r#"
markets: []
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "empty markets list should fail");
    let message = result.err().map(|err| err.to_string()).unwrap_or_default();
    assert!(
        message.contains("at least one market"),
        "unexpected error: {message}"
    );

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_clickhouse_url_parses_secure_target() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars(ENV_KEYS);

    let config_file = temp_yaml_path("binance-config-secure");
    let yaml = r#"
markets:
  - "XAUUSDT"
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

    let config_file = temp_yaml_path("binance-config-no-ch");
    let yaml = r#"
markets:
  - "XAUUSDT"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "missing ClickHouse URL should fail");

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
