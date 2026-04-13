use std::path::Path;

use config::{Environment, File};
use serde::{de::DeserializeOwned, Deserialize};
use thiserror::Error;

const ENV_PREFIX: &str = "ONDO_RECORDER";

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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenConfig {
    pub symbol: String,
    pub sizes: Vec<u32>,
}

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub api_url: String,
    pub api_key: String,
    pub chain_id: String,
    pub duration: String,
    pub tokens: Vec<TokenConfig>,
    pub clickhouse: ClickHouseTarget,
    pub poll_interval_seconds: f64,
    pub metrics_port: u16,
    pub health_port: u16,
    pub ready_stale_seconds: u64,
    pub queue_max_rows: usize,
    pub batch_max_rows: usize,
    pub batch_flush_seconds: f64,
    pub retention_days: u16,
    pub insert_async: bool,
}

#[derive(Debug, Deserialize, Default)]
struct OndoConfig {
    api_url: Option<String>,
    api_key: Option<String>,
    chain_id: Option<String>,
    duration: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenInput {
    symbol: String,
    #[serde(default = "default_sizes")]
    sizes: Vec<u32>,
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

        let ondo: OndoConfig = get_or_default(&loaded, "ondo", OndoConfig::default)?;
        let tokens_input: Vec<TokenInput> = get_or_default(&loaded, "tokens", default_tokens)?;
        let clickhouse_input: ClickHouseConfig =
            get_or_default(&loaded, "clickhouse", ClickHouseConfig::default)?;

        let api_url = ondo
            .api_url
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| default_api_url().to_string());
        let api_key = required_string(ondo.api_key, "ONDO_RECORDER__ONDO__API_KEY")?;
        let chain_id = ondo
            .chain_id
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "ethereum-1".to_string());
        let duration = ondo
            .duration
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "short".to_string());

        let tokens = parse_tokens(tokens_input)?;
        let clickhouse = parse_clickhouse_target(clickhouse_input)?;

        Ok(AppConfig {
            api_url,
            api_key,
            chain_id,
            duration,
            tokens,
            clickhouse,
            poll_interval_seconds: get_or_default(
                &loaded,
                "poll_interval_seconds",
                default_poll_interval_seconds,
            )?,
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

fn parse_tokens(tokens_input: Vec<TokenInput>) -> Result<Vec<TokenConfig>, ConfigError> {
    if tokens_input.is_empty() {
        return Err(ConfigError::Invalid(
            "At least one token is required".to_string(),
        ));
    }
    let mut tokens = Vec::with_capacity(tokens_input.len());
    for token in tokens_input {
        validate_token(&token)?;
        tokens.push(TokenConfig {
            symbol: token.symbol,
            sizes: token.sizes,
        });
    }
    Ok(tokens)
}

fn validate_token(token: &TokenInput) -> Result<(), ConfigError> {
    if token.symbol.trim().is_empty() {
        return Err(ConfigError::Invalid(
            "token symbol cannot be empty".to_string(),
        ));
    }
    if token.sizes.is_empty() {
        return Err(ConfigError::Invalid(format!(
            "token '{}' must have at least one size",
            token.symbol
        )));
    }
    for &size in &token.sizes {
        if size == 0 {
            return Err(ConfigError::Invalid(format!(
                "token '{}' has invalid size 0",
                token.symbol
            )));
        }
    }
    Ok(())
}

fn parse_clickhouse_target(input: ClickHouseConfig) -> Result<ClickHouseTarget, ConfigError> {
    let url = required_string(input.url, "ONDO_RECORDER__CLICKHOUSE__URL")?;
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

fn default_api_url() -> &'static str {
    "https://api.gm.ondo.finance/v1/attestations/soft"
}

fn default_sizes() -> Vec<u32> {
    vec![1, 10, 50, 100]
}

fn default_tokens() -> Vec<TokenInput> {
    vec![TokenInput {
        symbol: "AAPLon".to_string(),
        sizes: default_sizes(),
    }]
}

fn default_poll_interval_seconds() -> f64 {
    1.0
}

fn default_metrics_port() -> u16 {
    9093
}

fn default_health_port() -> u16 {
    8083
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

fn default_retention_days() -> u16 {
    90
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
    "ondo_quotes".to_string()
}
