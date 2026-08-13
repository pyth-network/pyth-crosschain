use std::path::Path;

use config::{Environment, File};
use derivative::Derivative;
use serde::{de::DeserializeOwned, Deserialize};
use thiserror::Error;

const ENV_PREFIX: &str = "OKX_RECORDER";

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
    pub book_ticker_table: String,
    pub trades_table: String,
    pub funding_rates_table: String,
}

/// Full multi-instrument recorder config. Mirrors `binance-recorder`'s
/// `AppConfig` with OKX instrument ids (`instruments`) in place of Binance
/// symbols: every configured instrument is subscribed on the single multiplexed
/// public websocket connection. Instruments are config-driven only — adding an
/// OKX perp needs no code change.
#[derive(Clone, Debug)]
pub struct AppConfig {
    pub instruments: Vec<String>,
    pub ws_url: String,
    pub clickhouse: ClickHouseTarget,
    pub metrics_port: u16,
    pub health_port: u16,
    pub ready_stale_seconds: u64,
    pub queue_max_rows: usize,
    pub batch_max_rows: usize,
    pub batch_flush_seconds: f64,
    pub reconnect_max_backoff_seconds: u64,
    pub insert_async: bool,
    pub funding_history_url: String,
    pub funding_poll_seconds: u64,
    pub funding_history_limit: u32,
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
    #[serde(default = "default_book_ticker_table")]
    book_ticker_table: String,
    #[serde(default = "default_trades_table")]
    trades_table: String,
    #[serde(default = "default_funding_rates_table")]
    funding_rates_table: String,
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
                    .with_list_parse_key("instruments")
                    .try_parsing(true),
            )
            .build()
            .map_err(|err| ConfigError::Invalid(err.to_string()))?;

        let instruments_input: Vec<String> =
            get_or_default(&loaded, "instruments", default_instruments)?;
        let instruments = parse_instruments(instruments_input)?;

        let clickhouse_input: ClickHouseConfig =
            get_or_default(&loaded, "clickhouse", ClickHouseConfig::default)?;
        let clickhouse = parse_clickhouse_target(clickhouse_input)?;

        Ok(AppConfig {
            instruments,
            ws_url: get_or_default(&loaded, "ws_url", default_ws_url)?,
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
            funding_history_url: get_or_default(
                &loaded,
                "funding_history_url",
                default_funding_history_url,
            )?,
            funding_poll_seconds: {
                let value = get_or_default(
                    &loaded,
                    "funding_poll_seconds",
                    default_funding_poll_seconds,
                )?;
                if value < 60 {
                    return Err(ConfigError::Invalid(
                        "funding_poll_seconds must be >= 60".to_string(),
                    ));
                }
                value
            },
            funding_history_limit: {
                let value: u32 = get_or_default(
                    &loaded,
                    "funding_history_limit",
                    default_funding_history_limit,
                )?;
                if !(1..=100).contains(&value) {
                    return Err(ConfigError::Invalid(
                        "funding_history_limit must be between 1 and 100".to_string(),
                    ));
                }
                value
            },
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

/// Validate and normalize the configured instrument list: reject an empty list
/// (or one with only blank entries), trim and upper-case each instrument id
/// (OKX instrument ids are upper-case, e.g. `OPENAI-USDT-SWAP`), and collapse
/// exact duplicates while preserving order.
fn parse_instruments(instruments_input: Vec<String>) -> Result<Vec<String>, ConfigError> {
    let mut instruments = Vec::with_capacity(instruments_input.len());
    let mut seen = std::collections::HashSet::with_capacity(instruments_input.len());
    for instrument in instruments_input {
        let inst_id = instrument.trim().to_uppercase();
        if inst_id.is_empty() {
            return Err(ConfigError::Invalid(
                "instrument id cannot be empty".to_string(),
            ));
        }
        if seen.insert(inst_id.clone()) {
            instruments.push(inst_id);
        }
    }
    if instruments.is_empty() {
        return Err(ConfigError::Invalid(
            "at least one instrument is required".to_string(),
        ));
    }
    Ok(instruments)
}

fn parse_clickhouse_target(input: ClickHouseConfig) -> Result<ClickHouseTarget, ConfigError> {
    let url = required_string(input.url, "OKX_RECORDER__CLICKHOUSE__URL")?;
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
        book_ticker_table: input.book_ticker_table,
        trades_table: input.trades_table,
        funding_rates_table: input.funding_rates_table,
    })
}

fn required_string(value: Option<String>, key: &str) -> Result<String, ConfigError> {
    match value {
        Some(value) if !value.trim().is_empty() => Ok(value),
        _ => Err(ConfigError::Missing(key.to_string())),
    }
}

/// The seeded instruments: pre-launch AI-lab perpetual swaps on OKX.
fn default_instruments() -> Vec<String> {
    ["OPENAI-USDT-SWAP", "ANTHROPIC-USDT-SWAP"]
        .iter()
        .map(|s| s.to_string())
        .collect()
}

fn default_ws_url() -> String {
    "wss://ws.okx.com:8443/ws/v5/public".to_string()
}

fn default_metrics_port() -> u16 {
    9095
}

fn default_health_port() -> u16 {
    8085
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

/// Ceiling for the jittered exponential backoff between websocket reconnect
/// attempts. Unlike `binance-recorder` (whose SDK owns reconnection), this
/// recorder hand-rolls the websocket client, so the backoff loop lives in
/// `stream_client`.
fn default_reconnect_max_backoff_seconds() -> u64 {
    30
}

fn default_insert_async() -> bool {
    true
}

fn default_funding_history_url() -> String {
    "https://www.okx.com/api/v5/public/funding-rate-history".to_string()
}

/// Funding settles on an hours-scale cadence, so a minutes-scale poll leaves
/// generous headroom while staying far under OKX's public rate limits. Values
/// below one minute are rejected as pointless hammering.
fn default_funding_poll_seconds() -> u64 {
    300
}

/// How many history rows to request per poll (`limit` query parameter; OKX
/// caps it at 100). Each poll re-fetches this trailing window, so the overlap
/// both self-heals short outages and exercises the sink's idempotence.
fn default_funding_history_limit() -> u32 {
    10
}

fn default_clickhouse_user() -> String {
    "default".to_string()
}

fn default_clickhouse_database() -> String {
    "default".to_string()
}

fn default_book_ticker_table() -> String {
    "okx_book_ticker".to_string()
}

fn default_trades_table() -> String {
    "okx_trades".to_string()
}

fn default_funding_rates_table() -> String {
    "okx_funding_rates".to_string()
}
