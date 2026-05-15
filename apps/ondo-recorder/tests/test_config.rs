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
  duration: "short"
tokens:
  - symbol: "AAPLon"
    chain_id: "ethereum-1"
    sizes: [1, 10, 50, 100]
  - symbol: "NVDAon"
    chain_id: "bsc-56"
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
    assert_eq!(config.tokens[0].chain_id, "ethereum-1");
    assert_eq!(config.tokens[0].sizes, vec![1, 10, 50, 100]);
    assert_eq!(config.tokens[1].symbol, "NVDAon");
    assert_eq!(config.tokens[1].chain_id, "bsc-56");
    assert_eq!(config.tokens[1].sizes, vec![1, 10]);
    assert_eq!(config.api_key, "test-key");
    assert_eq!(config.metrics_port, 9093);
    assert_eq!(config.health_port, 8083);
    assert_eq!(config.clickhouse.host, "127.0.0.1");
    assert_eq!(config.clickhouse.table, "ondo_quotes");

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_same_symbol_on_multiple_chains() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars([
        "ONDO_RECORDER__ONDO__API_KEY",
        "ONDO_RECORDER__CLICKHOUSE__URL",
    ]);

    let config_file = temp_yaml_path("ondo-config-multichain");
    let yaml = r#"
ondo:
  api_key: "test-key"
tokens:
  - symbol: "NVDAon"
    chain_id: "ethereum-1"
    sizes: [1]
  - symbol: "NVDAon"
    chain_id: "bsc-56"
    sizes: [1]
  - symbol: "NVDAon"
    chain_id: "solana-900"
    sizes: [1]
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let config =
        AppConfig::from_sources(Some(&config_file)).expect("multichain config should parse");
    assert_eq!(config.tokens.len(), 3);
    let chains: Vec<&str> = config.tokens.iter().map(|t| t.chain_id.as_str()).collect();
    assert_eq!(chains, vec!["ethereum-1", "bsc-56", "solana-900"]);
    for token in &config.tokens {
        assert_eq!(token.symbol, "NVDAon");
    }

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_duplicate_symbol_chain_pair_fails() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars([
        "ONDO_RECORDER__ONDO__API_KEY",
        "ONDO_RECORDER__CLICKHOUSE__URL",
    ]);

    let config_file = temp_yaml_path("ondo-config-dup");
    let yaml = r#"
ondo:
  api_key: "test-key"
tokens:
  - symbol: "NVDAon"
    chain_id: "ethereum-1"
    sizes: [1]
  - symbol: "NVDAon"
    chain_id: "ethereum-1"
    sizes: [10]
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "duplicate (symbol, chain_id) should fail");
    let message = result.err().map(|err| err.to_string()).unwrap_or_default();
    assert!(
        message.contains("duplicate token entry"),
        "unexpected error: {message}"
    );

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_missing_chain_id_fails() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars([
        "ONDO_RECORDER__ONDO__API_KEY",
        "ONDO_RECORDER__CLICKHOUSE__URL",
    ]);

    let config_file = temp_yaml_path("ondo-config-no-chain");
    let yaml = r#"
ondo:
  api_key: "test-key"
tokens:
  - symbol: "NVDAon"
    sizes: [1]
clickhouse:
  url: "http://127.0.0.1:8123"
"#;
    fs::write(&config_file, yaml).expect("write yaml config");
    let result = AppConfig::from_sources(Some(&config_file));
    assert!(result.is_err(), "missing chain_id should fail");

    let _ = fs::remove_file(config_file);
}

#[test]
fn test_env_overrides_yaml_values() {
    let _lock = ENV_LOCK.lock().expect("env lock poisoned");
    clear_env_vars([
        "ONDO_RECORDER__ONDO__API_URL",
        "ONDO_RECORDER__ONDO__API_KEY",
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
  duration: "short"
tokens:
  - symbol: "AAPLon"
    chain_id: "ethereum-1"
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
    chain_id: "ethereum-1"
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
