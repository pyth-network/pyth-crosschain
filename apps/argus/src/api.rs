use {
    crate::chain::reader::{BlockStatus, PulseReader},
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
    std::{collections::HashMap, sync::Arc},
    tokio::sync::RwLock,
    url::Url,
};
pub use {chain_ids::*, index::*, live::*, metrics::*, price_updates::*, ready::*};

mod chain_ids;
mod index;
mod live;
mod metrics;
mod price_updates;
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
    pub chains: Arc<HashMap<ChainId, BlockchainState>>,

    pub metrics_registry: Arc<RwLock<Registry>>,

    /// Prometheus metrics
    pub metrics: Arc<ApiMetrics>,
}

impl ApiState {
    pub async fn new(
        chains: HashMap<ChainId, BlockchainState>,
        metrics_registry: Arc<RwLock<Registry>>,
    ) -> ApiState {
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
            chains: Arc::new(chains),
            metrics: Arc::new(metrics),
            metrics_registry,
        }
    }
}

/// The state of the price update service for a single blockchain.
#[derive(Clone)]
pub struct BlockchainState {
    /// The chain id for this blockchain, useful for logging
    pub id: ChainId,
    /// The contract that the server is fulfilling requests for.
    pub contract: Arc<dyn PulseReader>,
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
    /// The caller requested price updates that can't currently be provided (because they
    /// haven't been committed to on-chain)
    NoPendingRequest,
    /// The server cannot currently communicate with the blockchain, so is not able to verify
    /// which price updates have been requested.
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
                "The request with the given sequence number has not been made yet, or the price updates have already been provided on chain.",
            ).into_response(),
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
            "/v1/chains/:chain_id/price-updates/:sequence",
            get(price_update),
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
            api::{self, ApiState, BlockchainState},
            chain::reader::{mock::MockPulseReader, BlockStatus},
        },
        axum::http::StatusCode,
        axum_test::{TestResponse, TestServer},
        ethers::prelude::{Address, U256},
        lazy_static::lazy_static,
        prometheus_client::registry::Registry,
        std::{collections::HashMap, sync::Arc},
        tokio::sync::RwLock,
    };

    const PROVIDER: Address = Address::zero();
    lazy_static! {
        static ref OTHER_PROVIDER: Address = Address::from_low_u64_be(1);
    }

    async fn test_server() -> (TestServer, Arc<MockPulseReader>, Arc<MockPulseReader>) {
        let eth_read = Arc::new(MockPulseReader::with_requests(10, &[]));

        let eth_state = BlockchainState {
            id: "ethereum".into(),
            contract: eth_read.clone(),
            provider_address: PROVIDER,
            confirmed_block_status: BlockStatus::Latest,
        };

        let metrics_registry = Arc::new(RwLock::new(Registry::default()));

        let avax_read = Arc::new(MockPulseReader::with_requests(10, &[]));

        let avax_state = BlockchainState {
            id: "avalanche".into(),
            contract: avax_read.clone(),
            provider_address: PROVIDER,
            confirmed_block_status: BlockStatus::Latest,
        };

        let mut chains = HashMap::new();
        chains.insert("ethereum".into(), eth_state);
        chains.insert("avalanche".into(), avax_state);

        let api_state = ApiState::new(chains, metrics_registry).await;

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
    async fn test_price_updates() {
        let (server, eth_contract, avax_contract) = test_server().await;
        let empty_price_ids: Vec<[u8; 32]> = vec![];
        let callback_gas_limit = U256::from(100000);
        let publish_time = U256::from(1000);

        // Can't access price updates if they haven't been requested
        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/0",
            StatusCode::FORBIDDEN,
        )
        .await;

        // Once someone requests the price updates, then they are accessible
        eth_contract.insert(
            PROVIDER,
            0,
            callback_gas_limit,
            empty_price_ids.clone(),
            publish_time,
        );
        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/0",
            StatusCode::OK,
        )
        .await;

        // Each chain and provider has its own set of requests
        eth_contract.insert(
            PROVIDER,
            100,
            callback_gas_limit,
            empty_price_ids.clone(),
            publish_time,
        );
        eth_contract.insert(
            *OTHER_PROVIDER,
            101,
            callback_gas_limit,
            empty_price_ids.clone(),
            publish_time,
        );
        eth_contract.insert(
            PROVIDER,
            102,
            callback_gas_limit,
            empty_price_ids.clone(),
            publish_time,
        );
        avax_contract.insert(
            PROVIDER,
            102,
            callback_gas_limit,
            empty_price_ids.clone(),
            publish_time,
        );
        avax_contract.insert(
            PROVIDER,
            103,
            callback_gas_limit,
            empty_price_ids.clone(),
            publish_time,
        );
        avax_contract.insert(
            *OTHER_PROVIDER,
            104,
            callback_gas_limit,
            empty_price_ids.clone(),
            publish_time,
        );

        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/100",
            StatusCode::OK,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/101",
            StatusCode::FORBIDDEN,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/102",
            StatusCode::OK,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/103",
            StatusCode::FORBIDDEN,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/104",
            StatusCode::FORBIDDEN,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/price-updates/100",
            StatusCode::FORBIDDEN,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/price-updates/101",
            StatusCode::FORBIDDEN,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/price-updates/102",
            StatusCode::OK,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/price-updates/103",
            StatusCode::OK,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/price-updates/104",
            StatusCode::FORBIDDEN,
        )
        .await;

        // Bad chain ids fail
        get_and_assert_status(
            &server,
            "/v1/chains/not_a_chain/price-updates/0",
            StatusCode::BAD_REQUEST,
        )
        .await;
    }

    #[tokio::test]
    async fn test_price_update_confirmation_delay() {
        let (server, eth_contract, avax_contract) = test_server().await;
        let empty_price_ids: Vec<[u8; 32]> = vec![];
        let callback_gas_limit = U256::from(100000);
        let publish_time = U256::from(1000);

        // No requests yet, so all requests should be forbidden
        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/0",
            StatusCode::FORBIDDEN,
        )
        .await;

        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/price-updates/100",
            StatusCode::FORBIDDEN,
        )
        .await;

        // Add requests - they should be immediately available
        eth_contract.insert(
            PROVIDER,
            0,
            callback_gas_limit,
            empty_price_ids.clone(),
            publish_time,
        );
        eth_contract.insert(
            PROVIDER,
            1,
            callback_gas_limit,
            empty_price_ids.clone(),
            publish_time,
        );
        avax_contract.insert(
            PROVIDER,
            100,
            callback_gas_limit,
            empty_price_ids.clone(),
            publish_time,
        );

        // All inserted requests should be immediately available
        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/0",
            StatusCode::OK,
        )
        .await;
        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/1",
            StatusCode::OK,
        )
        .await;
        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/price-updates/100",
            StatusCode::OK,
        )
        .await;

        // Non-inserted requests should still be forbidden
        get_and_assert_status(
            &server,
            "/v1/chains/ethereum/price-updates/2",
            StatusCode::FORBIDDEN,
        )
        .await;
        get_and_assert_status(
            &server,
            "/v1/chains/avalanche/price-updates/101",
            StatusCode::FORBIDDEN,
        )
        .await;
    }
}
