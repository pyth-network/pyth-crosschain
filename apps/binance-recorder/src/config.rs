use std::path::Path;

use config::{Environment, File};
use serde::{de::DeserializeOwned, Deserialize};
use thiserror::Error;

const ENV_PREFIX: &str = "BINANCE_RECORDER";

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Missing required configuration: {0}")]
    Missing(String),
    #[error("Invalid configuration: {0}")]
    Invalid(String),
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub struct ClickHouseTarget {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub secure: bool,
    pub database: String,
    pub table: String,
}

/// Minimal tracer config: a single symbol plus a ClickHouse target. The full
/// multi-market config module lands in a later slice; this is intentionally
/// small so the thinnest end-to-end path can be exercised first.
#[derive(Clone, Debug)]
pub struct AppConfig {
    pub symbol: String,
    pub clickhouse: ClickHouseTarget,
    pub ws_reconnect_delay_ms: u64,
    pub insert_async: bool,
}

#[derive(Debug, Deserialize, Default)]
struct ClickHouseConfig {
    url: Option<String>,
    #[serde(default = "default_clickhouse_user")]
    user: String,
    #[serde(default)]
    password: String,
    #[serde(default = "default_clickhouse_database")]
    database: String,
    #[serde(default = "default_clickhouse_table")]
    table: String,
}

impl AppConfig {
    pub fn from_sources(config_path: Option<&Path>) -> Result<Self, ConfigError> {
        let mut builder = config::Config::builder();
        if let Some(path) = config_path {
            builder = builder.add_source(File::from(path.to_path_buf()));
        }
        let loaded = builder
            .add_source(
                Environment::with_prefix(ENV_PREFIX)
                    .separator("__")
                    .try_parsing(true),
            )
            .build()
            .map_err(|err| ConfigError::Invalid(err.to_string()))?;

        let symbol = get_or_default(&loaded, "symbol", default_symbol)?;
        if symbol.trim().is_empty() {
            return Err(ConfigError::Invalid("symbol cannot be empty".to_string()));
        }

        let clickhouse_input: ClickHouseConfig =
            get_or_default(&loaded, "clickhouse", ClickHouseConfig::default)?;
        let clickhouse = parse_clickhouse_target(clickhouse_input)?;

        Ok(AppConfig {
            symbol: symbol.to_uppercase(),
            clickhouse,
            ws_reconnect_delay_ms: get_or_default(
                &loaded,
                "ws_reconnect_delay_ms",
                default_ws_reconnect_delay_ms,
            )?,
            insert_async: get_or_default(&loaded, "insert_async", default_insert_async)?,
        })
    }

    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_sources(None)
    }
}

fn get_or_default<T, F>(cfg: &config::Config, key: &str, default: F) -> Result<T, ConfigError>
where
    T: DeserializeOwned,
    F: FnOnce() -> T,
{
    match cfg.get::<T>(key) {
        Ok(value) => Ok(value),
        Err(config::ConfigError::NotFound(_)) => Ok(default()),
        Err(err) => Err(ConfigError::Invalid(err.to_string())),
    }
}

fn parse_clickhouse_target(input: ClickHouseConfig) -> Result<ClickHouseTarget, ConfigError> {
    let url = required_string(input.url, "BINANCE_RECORDER__CLICKHOUSE__URL")?;
    let parsed = reqwest::Url::parse(&url)
        .map_err(|_| ConfigError::Invalid(format!("Invalid ClickHouse URL: {url}")))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| ConfigError::Invalid(format!("Invalid ClickHouse URL: {url}")))?;
    let port = parsed
        .port_or_known_default()
        .ok_or_else(|| ConfigError::Invalid(format!("Invalid ClickHouse URL: {url}")))?;

    Ok(ClickHouseTarget {
        host: host.to_string(),
        port,
        username: input.user,
        password: input.password,
        secure: parsed.scheme() == "https",
        database: input.database,
        table: input.table,
    })
}

fn required_string(value: Option<String>, key: &str) -> Result<String, ConfigError> {
    match value {
        Some(value) if !value.trim().is_empty() => Ok(value),
        _ => Err(ConfigError::Missing(key.to_string())),
    }
}

fn default_symbol() -> String {
    "BTCUSDT".to_string()
}

fn default_ws_reconnect_delay_ms() -> u64 {
    5_000
}

fn default_insert_async() -> bool {
    true
}

fn default_clickhouse_user() -> String {
    "default".to_string()
}

fn default_clickhouse_database() -> String {
    "pyth_analytics".to_string()
}

fn default_clickhouse_table() -> String {
    "binance_book_ticker".to_string()
}
