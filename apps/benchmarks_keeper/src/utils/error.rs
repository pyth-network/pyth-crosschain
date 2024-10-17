use alloy::transports::TransportError;
use eyre::Report;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum BenchmarksKeeperError {
    #[error("Failed to connect to RPC: {0}")]
    RpcConnectionError(String),

    #[error("Failed to decode event log: {0}")]
    EventDecodeError(String),

    #[error("Transport error: {0}")]
    TransportError(#[from] TransportError),

    #[error("Other error: {0}")]
    Other(#[from] Report),
}
