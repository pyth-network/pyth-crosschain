use {
    crate::{
        chain::reader::EntropyReader,
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
        let map: HashMap<ChainId, BlockchainState> = chains.into_iter().cloned().collect();
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
    /// The contract that the server is fulfilling requests for.
    pub contract:         Arc<dyn EntropyReader>,
    /// The address of the provider that this server is operating for.
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

pub fn routes(state: ApiState) -> Router<(), Body> {
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
                BinaryEncoding,
                Blob,
                BlockchainState,
                GetRandomValueResponse,
            },
            chain::reader::mock::MockEntropyReader,
            state::{
                HashChainState,
                PebbleHashChain,
            },
        },
        axum::http::StatusCode,
        axum_test::{
            TestResponse,
            TestServer,
        },
        ethers::prelude::Address,
        lazy_static::lazy_static,
        std::sync::Arc,
    };

    const PROVIDER: Address = Address::zero();
    lazy_static! {
        static ref OTHER_PROVIDER: Address = Address::from_low_u64_be(1);
        // Note: these chains are immutable. They are wrapped in Arc because we need Arcs to
        // initialize the BlockchainStates below, but they aren't cloneable (nor do they need to be cloned).
        static ref ETH_CHAIN: Arc<HashChainState> = Arc::new(HashChainState::from_chain_at_offset(
            0,
            PebbleHashChain::new([0u8; 32], 1000),
        ));
        static ref AVAX_CHAIN: Arc<HashChainState> = Arc::new(HashChainState::from_chain_at_offset(
            100,
            PebbleHashChain::new([1u8; 32], 1000),
        ));
    }

    fn test_server() -> (TestServer, Arc<MockEntropyReader>, Arc<MockEntropyReader>) {
        let eth_read = Arc::new(MockEntropyReader::with_requests(&[]));

        let eth_state = BlockchainState {
            state:            ETH_CHAIN.clone(),
            contract:         eth_read.clone(),
            provider_address: PROVIDER,
        };

        let avax_read = Arc::new(MockEntropyReader::with_requests(&[]));

        let avax_state = BlockchainState {
            state:            AVAX_CHAIN.clone(),
            contract:         avax_read.clone(),
            provider_address: PROVIDER,
        };

        let api_state = ApiState::new(&[
            ("ethereum".into(), eth_state),
            ("avalanche".into(), avax_state),
        ]);

        let app = api::routes(api_state);
        (TestServer::new(app).unwrap(), eth_read, avax_read)
    }

    async fn get_and_assert_status(
        server: &TestServer,
        path: &str,
        status: StatusCode,
    ) -> TestResponse {
        let response = server.get(path).await;
        response.assert_status(status);
        response
    }

    #[tokio::test]
    async fn test_revelation() {
        let (server, eth_contract, avax_contract) = test_server();

        // Can't access a revelation if it hasn't been requested
        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/revelations/0",
            StatusCode::FORBIDDEN,
        )
        .await;

        // Once someone requests the number, then it is accessible
        eth_contract.insert(PROVIDER, 0);
        let response =
            get_and_assert_status(&server, "/v1/chains/ethereum/revelations/0", StatusCode::OK)
                .await;
        response.assert_json(&GetRandomValueResponse {
            value: Blob::new(BinaryEncoding::Hex, ETH_CHAIN.reveal(0).unwrap()),
        });

        // Each chain and provider has its own set of requests
        eth_contract.insert(PROVIDER, 100);
        eth_contract.insert(*OTHER_PROVIDER, 101);
        eth_contract.insert(PROVIDER, 102);
        avax_contract.insert(PROVIDER, 102);
        avax_contract.insert(PROVIDER, 103);
        avax_contract.insert(*OTHER_PROVIDER, 104);

        let response = get_and_assert_status(
            &server,
            "/v1/chains/ethereum/revelations/100",
            StatusCode::OK,
        )
        .await;
        response.assert_json(&GetRandomValueResponse {
            value: Blob::new(BinaryEncoding::Hex, ETH_CHAIN.reveal(100).unwrap()),
        });

        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/revelations/101",
            StatusCode::FORBIDDEN,
        )
        .await;
        let response = get_and_assert_status(
            &server,
            "/v1/chains/ethereum/revelations/102",
            StatusCode::OK,
        )
        .await;
        response.assert_json(&GetRandomValueResponse {
            value: Blob::new(BinaryEncoding::Hex, ETH_CHAIN.reveal(102).unwrap()),
        });
        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/revelations/103",
            StatusCode::FORBIDDEN,
        )
        .await;
        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/revelations/104",
            StatusCode::FORBIDDEN,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/100",
            StatusCode::FORBIDDEN,
        )
        .await;
        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/101",
            StatusCode::FORBIDDEN,
        )
        .await;
        let response = get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/102",
            StatusCode::OK,
        )
        .await;
        response.assert_json(&GetRandomValueResponse {
            value: Blob::new(BinaryEncoding::Hex, AVAX_CHAIN.reveal(102).unwrap()),
        });
        let response = get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/103",
            StatusCode::OK,
        )
        .await;
        response.assert_json(&GetRandomValueResponse {
            value: Blob::new(BinaryEncoding::Hex, AVAX_CHAIN.reveal(103).unwrap()),
        });
        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/104",
            StatusCode::FORBIDDEN,
        )
        .await;

        // Bad chain ids fail
        get_and_assert_status(
            &server,
            "/v1/chains/not_a_chain/revelations/0",
            StatusCode::BAD_REQUEST,
        )
        .await;

        // Requesting a number that has a request, but isn't in the HashChainState also fails.
        // (Note that this shouldn't happen in normal operation)
        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/99",
            StatusCode::FORBIDDEN,
        )
        .await;
        avax_contract.insert(PROVIDER, 99);
        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/99",
            StatusCode::INTERNAL_SERVER_ERROR,
        )
        .await;
    }
}
