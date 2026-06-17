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

/// Full multi-market recorder config. Mirrors `ondo-recorder`'s `AppConfig`
/// with a `markets: Vec<String>` list in place of the per-token configs: every
/// configured symbol is subscribed on the single combined `bookTicker`
/// connection.
#[derive(Clone, Debug)]
pub struct AppConfig {
    pub markets: Vec<String>,
    pub clickhouse: ClickHouseTarget,
    pub metrics_port: u16,
    pub health_port: u16,
    pub ready_stale_seconds: u64,
    pub queue_max_rows: usize,
    pub batch_max_rows: usize,
    pub batch_flush_seconds: f64,
    pub reconnect_max_backoff_seconds: u64,
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
                    .list_separator(",")
                    .with_list_parse_key("markets")
                    .try_parsing(true),
            )
            .build()
            .map_err(|err| ConfigError::Invalid(err.to_string()))?;

        let markets_input: Vec<String> = get_or_default(&loaded, "markets", default_markets)?;
        let markets = parse_markets(markets_input)?;

        let clickhouse_input: ClickHouseConfig =
            get_or_default(&loaded, "clickhouse", ClickHouseConfig::default)?;
        let clickhouse = parse_clickhouse_target(clickhouse_input)?;

        Ok(AppConfig {
            markets,
            clickhouse,
            metrics_port: get_or_default(&loaded, "metrics_port", default_metrics_port)?,
            health_port: get_or_default(&loaded, "health_port", default_health_port)?,
            ready_stale_seconds: get_or_default(
                &loaded,
                "ready_stale_seconds",
                default_ready_stale_seconds,
            )?,
            queue_max_rows: get_or_default(&loaded, "queue_max_rows", default_queue_max_rows)?,
            batch_max_rows: get_or_default(&loaded, "batch_max_rows", default_batch_max_rows)?,
            batch_flush_seconds: get_or_default(
                &loaded,
                "batch_flush_seconds",
                default_batch_flush_seconds,
            )?,
            reconnect_max_backoff_seconds: get_or_default(
                &loaded,
                "reconnect_max_backoff_seconds",
                default_reconnect_max_backoff_seconds,
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

/// Validate and normalize the configured market list: reject an empty list (or
/// one with only blank entries), trim and upper-case each symbol for storage,
/// and collapse exact duplicates while preserving order. Subscription lowercases
/// these again when building `BookTickerParams`.
fn parse_markets(markets_input: Vec<String>) -> Result<Vec<String>, ConfigError> {
    let mut markets = Vec::with_capacity(markets_input.len());
    let mut seen = std::collections::HashSet::with_capacity(markets_input.len());
    for market in markets_input {
        let symbol = market.trim().to_uppercase();
        if symbol.is_empty() {
            return Err(ConfigError::Invalid(
                "market symbol cannot be empty".to_string(),
            ));
        }
        if seen.insert(symbol.clone()) {
            markets.push(symbol);
        }
    }
    if markets.is_empty() {
        return Err(ConfigError::Invalid(
            "at least one market is required".to_string(),
        ));
    }
    Ok(markets)
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

/// The seeded index basket: tokenized equities/commodities tracked on Binance
/// spot. Stored upper-cased; subscribed lower-cased.
fn default_markets() -> Vec<String> {
    [
        "XAUUSDT", "XAGUSDT", "CLUSDT", "BZUSDT", "CRCLUSDT", "MSTRUSDT", "NVDAUSDT", "TSLAUSDT",
        "SPCXUSDT",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

fn default_metrics_port() -> u16 {
    9094
}

fn default_health_port() -> u16 {
    8084
}

fn default_ready_stale_seconds() -> u64 {
    10
}

fn default_queue_max_rows() -> usize {
    50_000
}

fn default_batch_max_rows() -> usize {
    10_000
}

fn default_batch_flush_seconds() -> f64 {
    2.0
}

/// Pause the SDK applies between websocket reconnect attempts. The official
/// `binance-sdk` owns reconnection internally and exposes a single fixed
/// reconnect delay rather than a jittered-backoff ceiling, so this value is the
/// effective backoff bound we plumb into `ConfigurationWebsocketStreams`.
fn default_reconnect_max_backoff_seconds() -> u64 {
    5
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
