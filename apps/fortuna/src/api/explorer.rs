use {
    crate::{
        api::{ApiBlockChainState, NetworkId, RestError},
        history::RequestStatus,
    },
    axum::{
        extract::{Query, State},
        Json,
    },
    chrono::{DateTime, Utc},
    ethers::types::{Address, TxHash},
    std::str::FromStr,
    utoipa::IntoParams,
};

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
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
    /// The maximum number of logs to return. Max value is 1000.
    #[param(default = 1000)]
    pub limit: Option<u64>,
    /// The offset to start returning logs from.
    #[param(default = 0)]
    pub offset: Option<u64>,
}

const LOG_RETURN_LIMIT: u64 = 1000;

/// Returns the logs of all requests captured by the keeper.
///
/// This endpoint allows you to filter the logs by a specific network ID, a query string (which can be a transaction hash, sender address, or sequence number), and a time range.
/// This is useful for debugging and monitoring the requests made to the Entropy contracts on various chains.
#[utoipa::path(
    get,
    path = "/v1/logs",
    responses((status = 200, description = "A list of Entropy request logs", body = Vec<RequestStatus>)),
    params(ExplorerQueryParams)
)]
pub async fn explorer(
    State(state): State<crate::api::ApiState>,
    Query(query_params): Query<ExplorerQueryParams>,
) -> anyhow::Result<Json<Vec<RequestStatus>>, RestError> {
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
    if let Some(limit) = query_params.limit {
        if limit > LOG_RETURN_LIMIT || limit == 0 {
            return Err(RestError::InvalidQueryString);
        }
    }
    if let Some(query) = query_params.query {
        if let Ok(tx_hash) = TxHash::from_str(&query) {
            return Ok(Json(
                state
                    .history
                    .get_requests_by_tx_hash(tx_hash)
                    .await
                    .map_err(|_| RestError::TemporarilyUnavailable)?,
            ));
        }
        if let Ok(sender) = Address::from_str(&query) {
            return Ok(Json(
                state
                    .history
                    .get_requests_by_sender(sender, query_params.network_id)
                    .await
                    .map_err(|_| RestError::TemporarilyUnavailable)?,
            ));
        }
        if let Ok(sequence_number) = u64::from_str(&query) {
            return Ok(Json(
                state
                    .history
                    .get_requests_by_sequence(sequence_number, query_params.network_id)
                    .await
                    .map_err(|_| RestError::TemporarilyUnavailable)?,
            ));
        }
        return Err(RestError::InvalidQueryString);
    }
    Ok(Json(
        state
            .history
            .get_requests_by_time(
                query_params.network_id,
                query_params.limit.unwrap_or(LOG_RETURN_LIMIT),
                query_params.offset.unwrap_or(0),
                query_params.min_timestamp,
                query_params.max_timestamp,
            )
            .await
            .map_err(|_| RestError::TemporarilyUnavailable)?,
    ))
}
