use anyhow::Context as _;
use config::{Environment, File};
use pusher_base::BaseConfig;
use serde::Deserialize;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use url::Url;

/// Main configuration for the bulk-trade-pusher service.
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// Base pusher configuration (lazer, feeds, prometheus)
    #[serde(flatten)]
    pub base: BaseConfig,

    /// Bulk Trade configuration (destination for price pushes)
    pub bulk: BulkConfig,

    /// Health endpoint address (default: 0.0.0.0:8080)
    #[serde(default = "default_health_address")]
    pub health_address: SocketAddr,
}

fn default_health_address() -> SocketAddr {
    SocketAddr::from(([0, 0, 0, 0], 8080))
}

/// Configuration for connecting to Bulk Trade validators.
#[derive(Debug, Clone, Deserialize)]
pub struct BulkConfig {
    /// Bulk validator WebSocket endpoints
    /// Multiple endpoints for redundancy (multi-node submission)
    pub endpoints: Vec<Url>,

    /// Path to file containing Ed25519 signing key (base58 encoded private key)
    /// Each pusher instance has its own signing key that's approved for the oracle account.
    /// Different signers avoid collision - no deduping needed.
    pub signing_key_path: PathBuf,

    /// Oracle account public key (base58 encoded)
    /// This is the "account" field in the transaction - shared by all pushers.
    /// The signing key must be approved/whitelisted for this account.
    pub oracle_account_pubkey_base58: String,
}

/// Load configuration from a TOML file and validate it.
pub fn load_config<P: AsRef<Path>>(path: P) -> anyhow::Result<Config> {
    let path = path.as_ref();
    let config: Config = config::Config::builder()
        .add_source(File::with_name(
            path.to_str().context("invalid config path")?,
        ))
        .add_source(Environment::with_prefix("BULK_PUSHER").separator("__"))
        .build()?
        .try_deserialize()?;

    validate_config(&config)?;
    Ok(config)
}

/// Validate configuration values.
fn validate_config(config: &Config) -> anyhow::Result<()> {
    // Validate bulk endpoints
    anyhow::ensure!(
        !config.bulk.endpoints.is_empty(),
        "bulk.endpoints cannot be empty - at least one validator endpoint is required"
    );

    // Validate signing key file exists
    anyhow::ensure!(
        config.bulk.signing_key_path.exists(),
        "bulk.signing_key_path does not exist: {}",
        config.bulk.signing_key_path.display()
    );

    // Validate oracle account is not empty
    anyhow::ensure!(
        !config.bulk.oracle_account_pubkey_base58.is_empty(),
        "bulk.oracle_account_pubkey_base58 cannot be empty"
    );

    // Validate feed subscriptions
    anyhow::ensure!(
        !config.base.feeds.subscriptions.is_empty(),
        "feeds.subscriptions cannot be empty - at least one feed subscription is required"
    );

    Ok(())
}

/// Load signing key from a .key file.
/// The file should contain the base58-encoded private key, optionally with whitespace.
pub fn load_signing_key(path: &Path) -> anyhow::Result<String> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read signing key from {}", path.display()))?;
    Ok(content.trim().to_string())
}
