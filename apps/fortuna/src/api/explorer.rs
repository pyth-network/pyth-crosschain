use crate::api::{ChainId, RestError};
use crate::history::RequestStatus;
use axum::extract::{Query, State};
use axum::Json;
use chrono::{DateTime, Utc};
use ethers::types::{Address, TxHash};
use std::str::FromStr;
use utoipa::IntoParams;

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct ExplorerQueryParams {
    /// Only return logs that are newer or equal to this timestamp.
    #[param(value_type = Option<String>, example = "2023-10-01T00:00:00Z")]
    pub min_timestamp: Option<DateTime<Utc>>,
    /// Only return logs that are older or equal to this timestamp.
    #[param(value_type = Option<String>, example = "2023-10-01T00:00:00Z")]
    pub max_timestamp: Option<DateTime<Utc>>,
    /// The query string to search for. This can be a transaction hash, sender address, or sequence number.
    pub query: Option<String>,
    #[param(value_type = Option<String>)]
    /// The chain ID to filter the results by.
    pub chain_id: Option<ChainId>,
}

const LOG_RETURN_LIMIT: u64 = 1000;

#[utoipa::path(
    get,
    path = "/v1/logs",
    responses(
    (status = 200, description = "Entropy request logs", body = Vec<RequestStatus>)
    ),
    params(ExplorerQueryParams)
)]
pub async fn explorer(
    State(state): State<crate::api::ApiState>,
    Query(query_params): Query<ExplorerQueryParams>,
) -> anyhow::Result<Json<Vec<RequestStatus>>, RestError> {
    if let Some(chain_id) = &query_params.chain_id {
        if !state.chains.read().await.contains_key(chain_id) {
            return Err(RestError::InvalidChainId);
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
                    .get_requests_by_sender(sender, query_params.chain_id)
                    .await
                    .map_err(|_| RestError::TemporarilyUnavailable)?,
            ));
        }
        if let Ok(sequence_number) = u64::from_str(&query) {
            return Ok(Json(
                state
                    .history
                    .get_requests_by_sequence(sequence_number, query_params.chain_id)
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
                query_params.chain_id,
                LOG_RETURN_LIMIT,
                query_params.min_timestamp,
                query_params.max_timestamp,
            )
            .await
            .map_err(|_| RestError::TemporarilyUnavailable)?,
    ))
}
