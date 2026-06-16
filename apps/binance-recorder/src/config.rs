use std::path::Path;

use config::{Environment, File};
use derivative::Derivative;
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

#[derive(Clone, Derivative, Eq, PartialEq, Deserialize)]
#[derivative(Debug)]
pub struct ClickHouseTarget {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[derivative(Debug = "ignore")]
    pub password: String,
    pub secure: bool,
    pub database: String,
    pub best_bid_ask_table: String,
}

#[derive(Clone, Derivative)]
#[derivative(Debug)]
pub struct AppConfig {
    pub binance_endpoint: String,
    #[derivative(Debug = "ignore")]
    pub binance_api_key: String,
    pub symbols: Vec<String>,
    pub clickhouse: ClickHouseTarget,
    pub metrics_port: u16,
    pub health_port: u16,
    pub ready_stale_seconds: u64,
    pub queue_max_rows: usize,
    pub batch_max_rows: usize,
    pub batch_flush_seconds: f64,
    pub retention_days: u16,
    pub insert_async: bool,
    pub reconnect_max_backoff_seconds: u64,
    pub ws_recycle_seconds: u64,
}

#[derive(Debug, Deserialize, Default)]
struct BinanceConfig {
    endpoint: Option<String>,
    api_key: Option<String>,
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
    #[serde(default = "default_clickhouse_best_bid_ask_table")]
    best_bid_ask_table: String,
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
                    .with_list_parse_key("symbols")
                    .try_parsing(true),
            )
            .build()
            .map_err(|err| ConfigError::Invalid(err.to_string()))?;

        let binance: BinanceConfig = get_or_default(&loaded, "binance", BinanceConfig::default)?;
        let symbols_input: Vec<String> = get_or_default(&loaded, "symbols", Vec::new)?;
        let clickhouse_input: ClickHouseConfig =
            get_or_default(&loaded, "clickhouse", ClickHouseConfig::default)?;

        let binance_endpoint = binance
            .endpoint
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(default_binance_endpoint);
        let binance_api_key =
            required_string(binance.api_key, "BINANCE_RECORDER__BINANCE__API_KEY")?;
        let symbols = parse_symbols(symbols_input)?;
        let clickhouse = parse_clickhouse_target(clickhouse_input)?;

        Ok(AppConfig {
            binance_endpoint,
            binance_api_key,
            symbols,
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
            retention_days: get_or_default(&loaded, "retention_days", default_retention_days)?,
            insert_async: get_or_default(&loaded, "insert_async", default_insert_async)?,
            reconnect_max_backoff_seconds: get_or_default(
                &loaded,
                "reconnect_max_backoff_seconds",
                default_reconnect_max_backoff_seconds,
            )?,
            ws_recycle_seconds: {
                let value: u64 =
                    get_or_default(&loaded, "ws_recycle_seconds", default_ws_recycle_seconds)?;
                if value == 0 {
                    return Err(ConfigError::Invalid(
                        "ws_recycle_seconds must be > 0".to_string(),
                    ));
                }
                value
            },
        })
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

/// Trim and lowercase each symbol, rejecting empty entries and an empty list so
/// a misconfiguration fails fast instead of silently recording nothing.
fn parse_symbols(input: Vec<String>) -> Result<Vec<String>, ConfigError> {
    let mut symbols = Vec::with_capacity(input.len());
    for raw in input {
        let normalized = raw.trim().to_lowercase();
        if normalized.is_empty() {
            return Err(ConfigError::Invalid(
                "symbols entries cannot be empty".to_string(),
            ));
        }
        symbols.push(normalized);
    }
    if symbols.is_empty() {
        return Err(ConfigError::Invalid(
            "at least one symbol is required".to_string(),
        ));
    }
    Ok(symbols)
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
        best_bid_ask_table: input.best_bid_ask_table,
    })
}

fn required_string(value: Option<String>, key: &str) -> Result<String, ConfigError> {
    match value {
        Some(value) if !value.trim().is_empty() => Ok(value),
        _ => Err(ConfigError::Missing(key.to_string())),
    }
}

fn default_binance_endpoint() -> String {
    "stream-sbe.binance.com:9443".to_string()
}

fn default_metrics_port() -> u16 {
    9092
}

fn default_health_port() -> u16 {
    8082
}

fn default_ready_stale_seconds() -> u64 {
    30
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

fn default_retention_days() -> u16 {
    90
}

fn default_insert_async() -> bool {
    true
}

fn default_reconnect_max_backoff_seconds() -> u64 {
    60
}

/// Recycle the connection well before Binance's hard 24h cap (~23h).
fn default_ws_recycle_seconds() -> u64 {
    82_800
}

fn default_clickhouse_user() -> String {
    "default".to_string()
}

fn default_clickhouse_database() -> String {
    "pyth_analytics".to_string()
}

fn default_clickhouse_best_bid_ask_table() -> String {
    "binance_best_bid_ask".to_string()
}
