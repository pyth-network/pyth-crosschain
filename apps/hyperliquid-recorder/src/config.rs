use std::path::Path;

use config::{Environment, File};
use serde::{de::DeserializeOwned, Deserialize};
use thiserror::Error;

use crate::models::MarketSubscription;

const ENV_PREFIX: &str = "HYPERLIQUID_RECORDER";

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
    pub l2_snapshots_table: String,
    pub trades_table: String,
}

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub quicknode_endpoint: String,
    pub quicknode_auth_token: String,
    pub markets: Vec<MarketSubscription>,
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
}

#[derive(Debug, Deserialize, Default)]
struct QuicknodeConfig {
    endpoint: Option<String>,
    auth_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MarketInput {
    coin: String,
    #[serde(default = "default_n_levels")]
    n_levels: u32,
    n_sig_figs: Option<u32>,
    mantissa: Option<u64>,
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
    #[serde(default = "default_clickhouse_l2_snapshots_table")]
    l2_snapshots_table: String,
    #[serde(default = "default_clickhouse_trades_table")]
    trades_table: String,
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
        let quicknode: QuicknodeConfig =
            get_or_default(&loaded, "quicknode", QuicknodeConfig::default)?;
        let markets_input: Vec<MarketInput> = get_or_default(&loaded, "markets", default_markets)?;
        let clickhouse_input: ClickHouseConfig =
            get_or_default(&loaded, "clickhouse", ClickHouseConfig::default)?;
        let quicknode_endpoint = required_string(
            quicknode.endpoint,
            "HYPERLIQUID_RECORDER__QUICKNODE__ENDPOINT",
        )?;
        let quicknode_auth_token = required_string(
            quicknode.auth_token,
            "HYPERLIQUID_RECORDER__QUICKNODE__AUTH_TOKEN",
        )?;
        let markets = parse_markets(markets_input)?;
        let clickhouse = parse_clickhouse_target(clickhouse_input)?;
        Ok(AppConfig {
            quicknode_endpoint,
            quicknode_auth_token,
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
            retention_days: get_or_default(&loaded, "retention_days", default_retention_days)?,
            insert_async: get_or_default(&loaded, "insert_async", default_insert_async)?,
            reconnect_max_backoff_seconds: get_or_default(
                &loaded,
                "reconnect_max_backoff_seconds",
                default_reconnect_max_backoff_seconds,
            )?,
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

fn parse_markets(markets_input: Vec<MarketInput>) -> Result<Vec<MarketSubscription>, ConfigError> {
    if markets_input.is_empty() {
        return Err(ConfigError::Invalid(
            "At least one market is required".to_string(),
        ));
    }
    let mut markets = Vec::with_capacity(markets_input.len());
    for market in markets_input {
        validate_market(&market)?;
        markets.push(MarketSubscription {
            coin: market.coin,
            n_levels: market.n_levels,
            n_sig_figs: market.n_sig_figs,
            mantissa: market.mantissa,
        });
    }
    Ok(markets)
}

fn validate_market(market: &MarketInput) -> Result<(), ConfigError> {
    if market.coin.trim().is_empty() {
        return Err(ConfigError::Invalid(
            "market coin cannot be empty".to_string(),
        ));
    }
    if !(1..=100).contains(&market.n_levels) {
        return Err(ConfigError::Invalid(
            "n_levels must be in [1, 100]".to_string(),
        ));
    }
    if let Some(value) = market.n_sig_figs {
        if !(2..=5).contains(&value) {
            return Err(ConfigError::Invalid(
                "n_sig_figs must be in [2, 5]".to_string(),
            ));
        }
    }
    if let Some(value) = market.mantissa {
        if !(1..=5).contains(&value) {
            return Err(ConfigError::Invalid(
                "mantissa must be in [1, 5]".to_string(),
            ));
        }
    }
    Ok(())
}

fn parse_clickhouse_target(input: ClickHouseConfig) -> Result<ClickHouseTarget, ConfigError> {
    let url = required_string(input.url, "HYPERLIQUID_RECORDER__CLICKHOUSE__URL")?;
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
        l2_snapshots_table: input.l2_snapshots_table,
        trades_table: input.trades_table,
    })
}

fn required_string(value: Option<String>, key: &str) -> Result<String, ConfigError> {
    match value {
        Some(value) if !value.trim().is_empty() => Ok(value),
        _ => Err(ConfigError::Missing(key.to_string())),
    }
}

fn default_n_levels() -> u32 {
    20
}

fn default_markets() -> Vec<MarketInput> {
    vec![MarketInput {
        coin: "BTC".to_string(),
        n_levels: default_n_levels(),
        n_sig_figs: None,
        mantissa: None,
    }]
}

fn default_metrics_port() -> u16 {
    9091
}

fn default_health_port() -> u16 {
    8080
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

fn default_clickhouse_user() -> String {
    "default".to_string()
}

fn default_clickhouse_database() -> String {
    "pyth_analytics".to_string()
}

fn default_clickhouse_l2_snapshots_table() -> String {
    "hyperliquid_l2_snapshots".to_string()
}

fn default_clickhouse_trades_table() -> String {
    "hyperliquid_trades".to_string()
}
