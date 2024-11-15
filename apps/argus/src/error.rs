use thiserror::Error;

#[derive(Debug, Error)]
pub enum ArgusError {
    #[error("Failed to fetch price updates from Hermes: {0}")]
    HermesError(#[from] HermesError),

    #[error("Contract error: {0}")]
    ContractError(#[from] ContractError),

    #[error("Storage error: {0}")]
    StorageError(#[from] StorageError),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

#[derive(Debug, Error)]
pub enum HermesError {
    #[error("HTTP request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),

    #[error("Invalid response encoding: {0}")]
    InvalidEncoding(String),

    #[error("No price updates found")]
    NoPriceUpdates,

    #[error("Failed to parse price data: {0}")]
    ParseError(String),

    #[error("Failed to decode hex data: {0}")]
    HexDecodeError(#[from] hex::FromHexError),
}

#[derive(Debug, Error)]
pub enum ContractError {
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),

    #[error("Gas estimation failed: {0}")]
    GasEstimationFailed(String),

    #[error("Invalid contract address: {0}")]
    InvalidAddress(String),

    #[error("Contract call failed: {0}")]
    CallFailed(String),
}

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Failed to read storage slot: {0}")]
    ReadError(String),

    #[error("Failed to parse storage data: {0}")]
    ParseError(String),

    #[error("Invalid storage layout: {0}")]
    InvalidLayout(String),
}
