use {
    crate::chain::reader::BlockStatus,
    anyhow::Result,
    axum::{
        body::Body,
        http::StatusCode,
        response::{IntoResponse, Response},
        routing::get,
        Router,
    },
    ethers::core::types::Address,
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{counter::Counter, family::Family},
        registry::Registry,
    },
    std::sync::Arc,
    tokio::sync::RwLock,
    url::Url,
};
pub use {index::*, live::*, metrics::*, ready::*};

mod index;
mod live;
mod metrics;
mod ready;

pub type ChainId = String;

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct RequestLabel {
    pub value: String,
}

pub struct ApiMetrics {
    pub http_requests: Family<RequestLabel, Counter>,
}

#[derive(Clone)]
pub struct ApiState {
    pub metrics_registry: Arc<RwLock<Registry>>,

    /// Prometheus metrics
    pub metrics: Arc<ApiMetrics>,
}

impl ApiState {
    pub async fn new(metrics_registry: Arc<RwLock<Registry>>) -> ApiState {
        let metrics = ApiMetrics {
            http_requests: Family::default(),
        };

        let http_requests = metrics.http_requests.clone();
        metrics_registry.write().await.register(
            "http_requests",
            "Number of HTTP requests received",
            http_requests,
        );

        ApiState {
            metrics: Arc::new(metrics),
            metrics_registry,
        }
    }
}

/// The state of the service for a single blockchain.
#[derive(Clone)]
pub struct BlockchainState {
    /// The chain id for this blockchain, useful for logging
    pub id: ChainId,
    /// The address of the provider that this server is operating for.
    pub provider_address: Address,
    /// The BlockStatus of the block that is considered to be confirmed on the blockchain.
    /// For eg., Finalized, Safe
    pub confirmed_block_status: BlockStatus,
}

pub enum RestError {
    /// The caller passed a sequence number that isn't within the supported range
    InvalidSequenceNumber,
    /// The caller passed an unsupported chain id
    InvalidChainId,
    /// The caller requested a random value that can't currently be revealed (because it
    /// hasn't been committed to on-chain)
    NoPendingRequest,
    /// The request exists, but the server is waiting for more confirmations (more blocks
    /// to be mined) before revealing the random number.
    PendingConfirmation,
    /// The server cannot currently communicate with the blockchain, so is not able to verify
    /// which random values have been requested.
    TemporarilyUnavailable,
    /// A catch-all error for all other types of errors that could occur during processing.
    Unknown,
}

impl IntoResponse for RestError {
    fn into_response(self) -> Response {
        match self {
            RestError::InvalidSequenceNumber => (
                StatusCode::BAD_REQUEST,
                "The sequence number is out of the permitted range",
            )
                .into_response(),
            RestError::InvalidChainId => {
                (StatusCode::BAD_REQUEST, "The chain id is not supported").into_response()
            }
            RestError::NoPendingRequest => (
                StatusCode::FORBIDDEN,
                "The request with the given sequence number has not been made yet, or the random value has already been revealed on chain.",
            ).into_response(),
            RestError::PendingConfirmation => (
                StatusCode::FORBIDDEN,
                "The request needs additional confirmations before the random value can be retrieved. Try your request again later.",
            )
                .into_response(),
            RestError::TemporarilyUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "This service is temporarily unavailable",
            )
                .into_response(),
            RestError::Unknown => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "An unknown error occurred processing the request",
            )
                .into_response(),
        }
    }
}

pub fn routes(state: ApiState) -> Router<(), Body> {
    Router::new()
        .route("/", get(index))
        .route("/live", get(live))
        .route("/metrics", get(metrics))
        .route("/ready", get(ready))
        .with_state(state)
}

/// We are registering the provider on chain with the following url:
/// `{base_uri}/v1/chains/{chain_id}`
/// The path and API are highly coupled. Please be sure to keep them consistent.
pub fn get_register_uri(base_uri: &str, chain_id: &str) -> Result<String> {
    let base_uri = Url::parse(base_uri)?;
    let path = format!("/v1/chains/{}", chain_id);
    let uri = base_uri.join(&path)?;
    Ok(uri.to_string())
}
