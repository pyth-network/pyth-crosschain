use ondo_recorder::config::AppConfig;
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
        "ONDO_RECORDER__ONDO__API_URL",
        "ONDO_RECORDER__ONDO__API_KEY",
        "ONDO_RECORDER__ONDO__CHAIN_ID",
        "ONDO_RECORDER__ONDO__DURATION",
        "ONDO_RECORDER__CLICKHOUSE__URL",
        "ONDO_RECORDER__CLICKHOUSE__USER",
        "ONDO_RECORDER__CLICKHOUSE__PASSWORD",
        "ONDO_RECORDER__CLICKHOUSE__DATABASE",
        "ONDO_RECORDER__CLICKHOUSE__TABLE",
        "ONDO_RECORDER__METRICS_PORT",
        "ONDO_RECORDER__HEALTH_PORT",
    ]);

    let config_file = temp_yaml_path("ondo-config");
    let yaml = r#"
ondo:
  api_url: "https://api.gm.ondo.finance/v1/attestations/soft"
  api_key: "test-key"
  chain_id: "ethereum-1"
  duration: "short"
tokens:
  - symbol: "AAPLon"
    sizes: [1, 10, 50, 100]
  - symbol: "NVDAon"
    sizes: [1, 10]
clickhouse:
  url: "http://127.0.0.1:8123"
  user: "recorder"
  password: "recorder"
  database: "pyth_analytics"
  table: "ondo_quotes"
metrics_port: 9093
health_port: 8083
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config = AppConfig::from_sources(Some(&config_file)).expect("yaml config should parse");
    assert_eq!(config.tokens.len(), 2);
    assert_eq!(config.tokens[0].symbol, "AAPLon");
    assert_eq!(config.tokens[0].sizes, vec![1, 10, 50, 100]);
    assert_eq!(config.tokens[1].symbol, "NVDAon");
    assert_eq!(config.tokens[1].sizes, vec![1, 10]);
    assert_eq!(config.api_key, "test-key");
    assert_eq!(config.chain_id, "ethereum-1");
    assert_eq!(config.metrics_port, 9093);
    assert_eq!(config.health_port, 8083);
    assert_eq!(config.clickhouse.host, "127.0.0.1");
    assert_eq!(config.clickhouse.table, "ondo_quotes");

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_env_overrides_yaml_values() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars([
        "ONDO_RECORDER__ONDO__API_URL",
        "ONDO_RECORDER__ONDO__API_KEY",
        "ONDO_RECORDER__ONDO__CHAIN_ID",
        "ONDO_RECORDER__ONDO__DURATION",
        "ONDO_RECORDER__CLICKHOUSE__URL",
        "ONDO_RECORDER__CLICKHOUSE__USER",
        "ONDO_RECORDER__CLICKHOUSE__PASSWORD",
        "ONDO_RECORDER__CLICKHOUSE__DATABASE",
        "ONDO_RECORDER__CLICKHOUSE__TABLE",
        "ONDO_RECORDER__METRICS_PORT",
    ]);

    let config_file = temp_yaml_path("ondo-config-overrides");
    let yaml = r#"
ondo:
  api_url: "https://api.gm.ondo.finance/v1/attestations/soft"
  api_key: "yaml-key"
  chain_id: "ethereum-1"
  duration: "short"
tokens:
  - symbol: "AAPLon"
    sizes: [1, 10]
clickhouse:
  url: "http://127.0.0.1:8123"
  user: "recorder"
  password: "recorder"
metrics_port: 9093
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    std::env::set_var("ONDO_RECORDER__ONDO__API_KEY", "env-key");
    std::env::set_var("ONDO_RECORDER__METRICS_PORT", "9191");

    let config = AppConfig::from_sources(Some(&config_file)).expect("config should parse");
    assert_eq!(config.api_key, "env-key");
    assert_eq!(config.metrics_port, 9191);

    clear_env_vars([
        "ONDO_RECORDER__ONDO__API_KEY",
        "ONDO_RECORDER__METRICS_PORT",
    ]);
    let _ = fs::remove_file(config_file);
}

#[test]
fn test_invalid_token_configuration_fails() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars([
        "ONDO_RECORDER__ONDO__API_KEY",
        "ONDO_RECORDER__CLICKHOUSE__URL",
    ]);

    let config_file = temp_yaml_path("ondo-config-invalid-token");
    let yaml = r#"
ondo:
  api_key: "test-key"
tokens:
  - symbol: ""
    sizes: [1, 10]
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "empty symbol should fail");
    let message = result.err().map(|err| err.to_string()).unwrap_or_default();
    assert!(
        message.contains("token symbol cannot be empty"),
        "unexpected error: {message}"
    );

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
