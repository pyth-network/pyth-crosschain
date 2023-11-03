use {
    crate::{
        api,
        chain::reader::EntropyRead,
        state::HashChainState,
    },
    axum::{
        body::Body,
        http::StatusCode,
        response::{
            IntoResponse,
            Response,
        },
        routing::get,
        Router,
    },
    ethers::core::types::Address,
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{
            counter::Counter,
            family::Family,
        },
        registry::Registry,
    },
    std::{
        collections::HashMap,
        ops::Add,
        sync::Arc,
    },
    tokio::sync::RwLock,
};
pub use {
    chain_ids::*,
    index::*,
    live::*,
    metrics::*,
    ready::*,
    revelation::*,
};

mod chain_ids;
mod index;
mod live;
mod metrics;
mod ready;
mod revelation;

pub type ChainId = String;

#[derive(Clone)]
pub struct ApiState {
    pub chains: Arc<HashMap<ChainId, BlockchainState>>,

    /// Prometheus metrics
    pub metrics: Arc<Metrics>,
}

impl ApiState {
    pub fn new(chains: &[(ChainId, BlockchainState)]) -> ApiState {
        let map: HashMap<ChainId, BlockchainState> =
            chains.into_iter().map(|r| (*r).clone()).collect();
        ApiState {
            chains:  Arc::new(map),
            metrics: Arc::new(Metrics::new()),
        }
    }
}

/// The state of the randomness service for a single blockchain.
#[derive(Clone)]
pub struct BlockchainState {
    /// The hash chain(s) required to serve random numbers for this blockchain
    pub state:            Arc<HashChainState>,
    /// The EVM contract where the protocol is running.
    pub contract:         Arc<dyn EntropyRead>,
    /// The EVM address of the provider that this server is operating for.
    pub provider_address: Address,
}

pub struct Metrics {
    pub registry:        RwLock<Registry>,
    // TODO: track useful metrics. this counter is just a placeholder to get things set up.
    pub request_counter: Family<Label, Counter>,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct Label {
    value: String,
}

impl Metrics {
    pub fn new() -> Self {
        let mut metrics_registry = Registry::default();
        let http_requests = Family::<Label, Counter>::default();

        // Register the metric family with the registry.
        metrics_registry.register(
            // With the metric name.
            "http_requests",
            // And the metric help text.
            "Number of HTTP requests received",
            http_requests.clone(),
        );

        Metrics {
            registry:        RwLock::new(metrics_registry),
            request_counter: http_requests,
        }
    }
}

pub enum RestError {
    /// The caller passed a sequence number that isn't within the supported range
    InvalidSequenceNumber,
    /// The caller passed an unsupported chain id
    InvalidChainId,
    /// The caller requested a random value that can't currently be revealed (because it
    /// hasn't been committed to on-chain)
    NoPendingRequest,
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
                "The random value cannot currently be retrieved",
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

pub fn v1_routes(state: ApiState) -> Router<(), Body> {
    Router::new()
        .route("/", get(index))
        .route("/live", get(live))
        .route("/metrics", get(metrics))
        .route("/ready", get(ready))
        .route("/v1/chains", get(chain_ids))
        .route(
            "/v1/chains/:chain_id/revelations/:sequence",
            get(revelation),
        )
        .with_state(state)
}

#[cfg(test)]
mod test {
    use {
        crate::{
            api::{
                self,
                ApiState,
                BlockchainState,
                ChainId,
            },
            chain::reader::test::mock_chain,
            state::{
                HashChainState,
                PebbleHashChain,
            },
        },
        axum_test::TestServer,
        ethers::prelude::Address,
        std::sync::Arc,
    };

    pub fn test_server(hash_chain: PebbleHashChain) -> TestServer {
        let provider_1 = Address::zero();
        let secret_1 = [0u8; 32];
        let hash_chain_state_1 = HashChainState::from_offset(0, hash_chain);

        let eth_read = mock_chain(&[(provider_1, 0)]);

        let blockchain_state = BlockchainState {
            state:            Arc::new(hash_chain_state_1),
            contract:         Arc::new(eth_read),
            provider_address: provider_1,
        };

        let api_state = ApiState::new(&[("ethereum".into(), blockchain_state)]);

        let app = api::v1_routes(api_state);
        TestServer::new(app).unwrap()
    }
}
