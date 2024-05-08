use {
    crate::{
        chain::reader::{
            BlockNumber,
            BlockStatus,
            EntropyReader,
        },
        metrics::Metrics,
        state::HashChainState,
    },
    anyhow::Result,
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
    std::{
        collections::HashMap,
        sync::Arc,
    },
    url::Url,
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
    /// The chain id for this blockchain, useful for logging
    pub id:                     ChainId,
    /// The hash chain(s) required to serve random numbers for this blockchain
    pub state:                  Arc<HashChainState>,
    /// The contract that the server is fulfilling requests for.
    pub contract:               Arc<dyn EntropyReader>,
    /// The address of the provider that this server is operating for.
    pub provider_address:       Address,
    /// The server will wait for this many block confirmations of a request before revealing
    /// the random number.
    pub reveal_delay_blocks:    BlockNumber,
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
                "The random value cannot currently be retrieved",
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
        .route("/v1/chains", get(chain_ids))
        .route(
            "/v1/chains/:chain_id/revelations/:sequence",
            get(revelation),
        )
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
            chain::reader::{
                mock::MockEntropyReader,
                BlockStatus,
            },
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
        let eth_read = Arc::new(MockEntropyReader::with_requests(10, &[]));

        let eth_state = BlockchainState {
            id:                     "ethereum".into(),
            state:                  ETH_CHAIN.clone(),
            contract:               eth_read.clone(),
            provider_address:       PROVIDER,
            reveal_delay_blocks:    1,
            confirmed_block_status: BlockStatus::Latest,
        };

        let avax_read = Arc::new(MockEntropyReader::with_requests(10, &[]));

        let avax_state = BlockchainState {
            id:                     "avalanche".into(),
            state:                  AVAX_CHAIN.clone(),
            contract:               avax_read.clone(),
            provider_address:       PROVIDER,
            reveal_delay_blocks:    2,
            confirmed_block_status: BlockStatus::Latest,
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
        eth_contract.insert(PROVIDER, 0, 1, false);
        let response =
            get_and_assert_status(&server, "/v1/chains/ethereum/revelations/0", StatusCode::OK)
                .await;
        response.assert_json(&GetRandomValueResponse {
            value: Blob::new(BinaryEncoding::Hex, ETH_CHAIN.reveal(0).unwrap()),
        });

        // Each chain and provider has its own set of requests
        eth_contract.insert(PROVIDER, 100, 1, false);
        eth_contract.insert(*OTHER_PROVIDER, 101, 1, false);
        eth_contract.insert(PROVIDER, 102, 1, false);
        avax_contract.insert(PROVIDER, 102, 1, false);
        avax_contract.insert(PROVIDER, 103, 1, false);
        avax_contract.insert(*OTHER_PROVIDER, 104, 1, false);

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
        avax_contract.insert(PROVIDER, 99, 1, false);
        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/99",
            StatusCode::INTERNAL_SERVER_ERROR,
        )
        .await;
    }

    #[tokio::test]
    async fn test_revelation_confirmation_delay() {
        let (server, eth_contract, avax_contract) = test_server();

        eth_contract.insert(PROVIDER, 0, 10, false);
        eth_contract.insert(PROVIDER, 1, 11, false);
        eth_contract.insert(PROVIDER, 2, 12, false);

        avax_contract.insert(PROVIDER, 100, 10, false);
        avax_contract.insert(PROVIDER, 101, 11, false);

        eth_contract.set_block_number(10);
        avax_contract.set_block_number(10);

        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/revelations/0",
            StatusCode::FORBIDDEN,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/100",
            StatusCode::FORBIDDEN,
        )
        .await;

        eth_contract.set_block_number(11);
        avax_contract.set_block_number(11);

        get_and_assert_status(&server, "/v1/chains/ethereum/revelations/0", StatusCode::OK).await;

        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/revelations/1",
            StatusCode::FORBIDDEN,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/100",
            StatusCode::FORBIDDEN,
        )
        .await;

        eth_contract.set_block_number(12);
        avax_contract.set_block_number(12);

        get_and_assert_status(&server, "/v1/chains/ethereum/revelations/1", StatusCode::OK).await;

        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/revelations/2",
            StatusCode::FORBIDDEN,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/100",
            StatusCode::OK,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/revelations/101",
            StatusCode::FORBIDDEN,
        )
        .await;
    }
}
