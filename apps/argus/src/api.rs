use {
    crate::chain::reader::BlockStatus,
    axum::{
        body::Body,
        http::StatusCode,
        response::{IntoResponse, Response},
        routing::get,
        Router,
    },
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{counter::Counter, family::Family},
        registry::Registry,
    },
    std::sync::Arc,
    tokio::sync::RwLock,
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
    /// The BlockStatus of the block that is considered to be confirmed on the blockchain.
    /// For eg., Finalized, Safe
    pub confirmed_block_status: BlockStatus,
}

pub enum RestError {
    /// The server cannot currently communicate with the blockchain, so is not able to verify
    /// which random values have been requested.
    TemporarilyUnavailable,
    /// A catch-all error for all other types of errors that could occur during processing.
    Unknown,
}

impl IntoResponse for RestError {
    fn into_response(self) -> Response {
        match self {
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
