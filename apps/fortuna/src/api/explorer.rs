use {
    crate::{
        api::{examples, ApiBlockChainState, NetworkId, RestError, StateTag},
        config::LATENCY_BUCKETS,
        history::{RequestQueryBuilder, RequestStatus, SearchField},
    },
    axum::{
        extract::{Query, State},
        Json,
    },
    chrono::{DateTime, Utc},
    prometheus_client::{
        encoding::{EncodeLabelSet, EncodeLabelValue},
        metrics::{family::Family, histogram::Histogram},
        registry::Registry,
    },
    std::sync::Arc,
    tokio::{sync::RwLock, time::Instant},
    utoipa::IntoParams,
};

#[derive(Debug)]
pub struct ExplorerMetrics {
    results_latency: Family<QueryTags, Histogram>,
    count_latency: Family<QueryTags, Histogram>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, EncodeLabelSet)]
pub struct QueryTags {
    search_type: Option<SearchType>,
    has_network_id_filter: bool,
    has_state_filter: bool,
}

impl<'a> From<RequestQueryBuilder<'a>> for QueryTags {
    fn from(builder: RequestQueryBuilder<'a>) -> Self {
        QueryTags {
            search_type: builder.search.map(|val| match val {
                SearchField::TxHash(_) => SearchType::TxHash,
                SearchField::Sender(_) => SearchType::Sender,
                SearchField::SequenceNumber(_) => SearchType::SequenceNumber,
            }),
            has_network_id_filter: builder.network_id.is_some(),
            has_state_filter: builder.state.is_some(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, EncodeLabelValue)]
enum SearchType {
    TxHash,
    Sender,
    SequenceNumber,
}

impl ExplorerMetrics {
    pub async fn new(metrics_registry: Arc<RwLock<Registry>>) -> Self {
        let mut guard = metrics_registry.write().await;
        let sub_registry = guard.sub_registry_with_prefix("explorer");

        let results_latency = Family::<QueryTags, Histogram>::new_with_constructor(|| {
            Histogram::new(LATENCY_BUCKETS.into_iter())
        });
        sub_registry.register(
            "results_latency",
            "The latency of requests to the database to collect the limited results.",
            results_latency.clone(),
        );

        let count_latency = Family::<QueryTags, Histogram>::new_with_constructor(|| {
            Histogram::new(LATENCY_BUCKETS.into_iter())
        });
        sub_registry.register(
            "count_latency",
            "The latency of requests to the database to collect the total matching result count.",
            count_latency.clone(),
        );

        Self {
            results_latency,
            count_latency,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct ExplorerQueryParams {
    /// Only return logs that are newer or equal to this timestamp. Timestamp is in ISO 8601 format with UTC timezone.
    #[param(value_type = Option<String>, example = "2023-10-01T00:00:00Z")]
    pub min_timestamp: Option<DateTime<Utc>>,
    /// Only return logs that are older or equal to this timestamp. Timestamp is in ISO 8601 format with UTC timezone.
    #[param(value_type = Option<String>, example = "2033-10-01T00:00:00Z")]
    pub max_timestamp: Option<DateTime<Utc>>,
    /// The query string to search for. This can be a transaction hash, sender address, or sequence number.
    #[param(example = "0xfe5f880ac10c0aae43f910b5a17f98a93cdd2eb2dce3a5ae34e5827a3a071a32")]
    pub query: Option<String>,
    /// The network ID to filter the results by (e.g., 1 for Ethereum mainnet, 43114 for Avalanche).
    #[param(value_type = Option<u64>, example = examples::network_id_example)]
    pub network_id: Option<NetworkId>,
    /// The state to filter the results by (Pending, Completed, Failed, or CallbackErrored).
    #[param(example = "Completed")]
    pub state: Option<StateTag>,
    /// The maximum number of logs to return. Max value is 1000.
    #[param(default = 1000, example = examples::limit_example)]
    pub limit: Option<u64>,
    /// The offset to start returning logs from.
    #[param(default = 0, example = examples::offset_example)]
    pub offset: Option<u64>,
}

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct ExplorerResponse {
    /// List of entropy request logs matching the query
    pub requests: Vec<RequestStatus>,
    /// Total number of results matching the query (may be more than returned due to limit)
    #[schema(example = 42)]
    pub total_results: i64,
}

/// Returns the logs of all requests captured by the keeper.
///
/// This endpoint allows you to filter the logs by a specific network ID, a query string (which can be a transaction hash, sender address, or sequence number), and a time range.
/// This is useful for debugging and monitoring the requests made to the Entropy contracts on various chains.
#[utoipa::path(
    get,
    path = "/v1/logs",
    responses((status = 200, description = "A list of Entropy request logs", body = ExplorerResponse,
        example = json!({
            "requests": [{
                "chain_id": "ethereum",
                "network_id": 1,
                "provider": "0x6cc14824ea2918f5de5c2f75a9da968ad4bd6344",
                "sequence": 12345,
                "created_at": "2023-10-01T00:00:00Z",
                "last_updated_at": "2023-10-01T00:00:05Z",
                "request_block_number": 19000000,
                "request_tx_hash": "0x5a3a984f41bb5443f5efa6070ed59ccb25edd8dbe6ce7f9294cf5caa64ed00ae",
                "gas_limit": 500000,
                "user_random_number": "a905ab56567d31a7fda38ed819d97bc257f3ebe385fc5c72ce226d3bb855f0fe",
                "sender": "0x78357316239040e19fc823372cc179ca75e64b81",
                "state": "completed",
                "reveal_block_number": 19000005,
                "reveal_tx_hash": "0xfe5f880ac10c0aae43f910b5a17f98a93cdd2eb2dce3a5ae34e5827a3a071a32",
                "provider_random_number": "deeb67cb894c33f7b20ae484228a9096b51e8db11461fcb0975c681cf0875d37",
                "gas_used": "567890",
                "combined_random_number": "1c26ffa1f8430dc91cb755a98bf37ce82ac0e2cfd961e10111935917694609d5",
                "callback_failed": false,
                "callback_return_value": "0x",
                "callback_gas_used": 100000
            }],
            "total_results": 42
        })
    )),
    params(ExplorerQueryParams)
)]
pub async fn explorer(
    State(state): State<crate::api::ApiState>,
    Query(query_params): Query<ExplorerQueryParams>,
) -> anyhow::Result<Json<ExplorerResponse>, RestError> {
    if let Some(network_id) = &query_params.network_id {
        if !state
            .chains
            .read()
            .await
            .iter()
            .any(|(_, state)| match state {
                ApiBlockChainState::Uninitialized => false,
                ApiBlockChainState::Initialized(state) => state.network_id == *network_id,
            })
        {
            return Err(RestError::InvalidChainId);
        }
    }
    let mut query = state.history.query();
    if let Some(search) = query_params.query {
        query = query
            .search(search)
            .map_err(|_| RestError::InvalidQueryString)?;
    }
    if let Some(network_id) = query_params.network_id {
        query = query.network_id(network_id);
    }
    if let Some(state) = query_params.state {
        query = query.state(state);
    }
    if let Some(limit) = query_params.limit {
        query = query
            .limit(limit)
            .map_err(|_| RestError::InvalidQueryString)?;
    }
    if let Some(offset) = query_params.offset {
        query = query.offset(offset);
    }
    if let Some(min_timestamp) = query_params.min_timestamp {
        query = query.min_timestamp(min_timestamp);
    }
    if let Some(max_timestamp) = query_params.max_timestamp {
        query = query.max_timestamp(max_timestamp);
    }

    let results_latency = &state.explorer_metrics.results_latency;
    let count_latency = &state.explorer_metrics.count_latency;
    let query_tags = &query.clone().into();
    let (requests, total_results) = tokio::join!(
        measure_latency(results_latency, query_tags, query.execute()),
        measure_latency(count_latency, query_tags, query.count_results())
    );
    let requests = requests.map_err(|_| RestError::TemporarilyUnavailable)?;
    let total_results = total_results.map_err(|_| RestError::TemporarilyUnavailable)?;

    Ok(Json(ExplorerResponse {
        requests,
        total_results,
    }))
}

async fn measure_latency<T, F>(
    metric: &Family<QueryTags, Histogram>,
    query_tags: &QueryTags,
    function: F,
) -> T
where
    F: std::future::Future<Output = T>,
{
    let start = Instant::now();
    let return_value = function.await;
    metric
        .get_or_create(query_tags)
        .observe(start.elapsed().as_secs_f64());
    return_value
}
