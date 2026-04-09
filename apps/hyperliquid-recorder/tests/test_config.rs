use hyperliquid_recorder::config::AppConfig;
use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

static ENV_LOCK: Mutex<()> = Mutex::new(());

#[test]
fn test_config_parses_yaml_file() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars([
        "HYPERLIQUID_RECORDER__QUICKNODE__ENDPOINT",
        "HYPERLIQUID_RECORDER__QUICKNODE__AUTH_TOKEN",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__URL",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__USER",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__PASSWORD",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__DATABASE",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__L2_SNAPSHOTS_TABLE",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__TRADES_TABLE",
        "HYPERLIQUID_RECORDER__METRICS_PORT",
        "HYPERLIQUID_RECORDER__HEALTH_PORT",
    ]);

    let config_file = temp_yaml_path("hrec-config");
    let yaml = r#"
quicknode:
  endpoint: "example:10000"
  auth_token: "yaml-token"
markets:
  - coin: "BTC"
    n_levels: 20
  - coin: "@142"
    n_levels: 10
    n_sig_figs: 3
    mantissa: 1
clickhouse:
  url: "http://127.0.0.1:8123"
  user: "recorder"
  password: "recorder"
  database: "pyth_analytics"
  l2_snapshots_table: "hyperliquid_l2_snapshots"
  trades_table: "hyperliquid_trades"
metrics_port: 9092
health_port: 8082
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config = AppConfig::from_sources(Some(&config_file)).expect("yaml config should parse");
    assert_eq!(config.markets.len(), 2);
    assert_eq!(config.markets[0].coin, "BTC");
    assert_eq!(config.markets[1].coin, "@142");
    assert_eq!(config.markets[1].n_sig_figs, Some(3));
    assert_eq!(config.markets[1].mantissa, Some(1));
    assert_eq!(config.quicknode_auth_token, "yaml-token");
    assert_eq!(config.metrics_port, 9092);
    assert_eq!(config.health_port, 8082);
    assert_eq!(config.clickhouse.host, "127.0.0.1");
    assert_eq!(config.clickhouse.trades_table, "hyperliquid_trades");

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_env_overrides_yaml_values() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars([
        "HYPERLIQUID_RECORDER__QUICKNODE__ENDPOINT",
        "HYPERLIQUID_RECORDER__QUICKNODE__AUTH_TOKEN",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__URL",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__USER",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__PASSWORD",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__DATABASE",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__L2_SNAPSHOTS_TABLE",
        "HYPERLIQUID_RECORDER__CLICKHOUSE__TRADES_TABLE",
        "HYPERLIQUID_RECORDER__METRICS_PORT",
    ]);

    let config_file = temp_yaml_path("hrec-config-overrides");
    let yaml = r#"
quicknode:
  endpoint: "yaml-endpoint:10000"
  auth_token: "yaml-token"
markets:
  - coin: "BTC"
    n_levels: 20
clickhouse:
  url: "http://127.0.0.1:8123"
  user: "recorder"
  password: "recorder"
  database: "pyth_analytics"
  l2_snapshots_table: "hyperliquid_l2_snapshots"
  trades_table: "hyperliquid_trades"
metrics_port: 9092
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    unsafe {
        std::env::set_var("HYPERLIQUID_RECORDER__QUICKNODE__AUTH_TOKEN", "env-token");
        std::env::set_var("HYPERLIQUID_RECORDER__METRICS_PORT", "9191");
    }

    let config = AppConfig::from_sources(Some(&config_file)).expect("config should parse");
    assert_eq!(config.quicknode_auth_token, "env-token");
    assert_eq!(config.metrics_port, 9191);

    clear_env_vars([
        "HYPERLIQUID_RECORDER__QUICKNODE__AUTH_TOKEN",
        "HYPERLIQUID_RECORDER__METRICS_PORT",
    ]);
    let _ = fs::remove_file(config_file);
}

#[test]
fn test_invalid_market_configuration_fails() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    let config_file = temp_yaml_path("hrec-config-invalid-market");
    let yaml = r#"
quicknode:
  endpoint: "example:10000"
  auth_token: "token"
markets:
  - coin: "BTC"
    n_levels: 101
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "invalid n_levels should fail");
    let message = result.err().map(|err| err.to_string()).unwrap_or_default();
    assert!(
        message.contains("n_levels must be in [1, 100]"),
        "unexpected error: {message}"
    );

    let _ = fs::remove_file(config_file);
}

fn clear_env_vars<'a>(keys: impl IntoIterator<Item = &'a str>) {
    for key in keys {
        unsafe { std::env::remove_var(key) };
    }
}

fn temp_yaml_path(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock drift")
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}-{nanos}.yaml"))
}
