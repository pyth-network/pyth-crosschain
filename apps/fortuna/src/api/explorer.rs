use {
    crate::{
        api::{ApiBlockChainState, NetworkId, RestError, StateTag},
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
    pub query: Option<String>,
    /// The network ID to filter the results by.
    #[param(value_type = Option<u64>)]
    pub network_id: Option<NetworkId>,
    /// The state to filter the results by.
    pub state: Option<StateTag>,
    /// The maximum number of logs to return. Max value is 1000.
    #[param(default = 1000)]
    pub limit: Option<u64>,
    /// The offset to start returning logs from.
    #[param(default = 0)]
    pub offset: Option<u64>,
}

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct ExplorerResponse {
    pub requests: Vec<RequestStatus>,
    pub total_results: u64,
}

/// Returns the logs of all requests captured by the keeper.
///
/// This endpoint allows you to filter the logs by a specific network ID, a query string (which can be a transaction hash, sender address, or sequence number), and a time range.
/// This is useful for debugging and monitoring the requests made to the Entropy contracts on various chains.
#[utoipa::path(
    get,
    path = "/v1/logs",
    responses((status = 200, description = "A list of Entropy request logs", body = ExplorerResponse)),
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
