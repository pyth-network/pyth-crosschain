use crate::api::{ChainId, RestError};
use crate::history::RequestStatus;
use axum::extract::{Query, State};
use axum::Json;
use ethers::types::{Address, TxHash};
use std::str::FromStr;
use utoipa::{IntoParams, ToSchema};

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct ExplorerQueryParams {
    pub min_timestamp: Option<u64>,
    pub max_timestamp: Option<u64>,
    pub query: Option<String>,
    #[param(value_type = Option<String>)]
    pub chain_id: Option<ChainId>,
}

#[utoipa::path(
    get,
    path = "/v1/explorer",
    responses(
    (status = 200, description = "Random value successfully retrieved", body = Vec<RequestJournal>)
    ),
    params(ExplorerQueryParams)
)]
pub async fn explorer(
    State(state): State<crate::api::ApiState>,
    Query(query_params): Query<ExplorerQueryParams>,
) -> anyhow::Result<Json<Vec<RequestStatus>>, RestError> {
    if let Some(query) = query_params.query {
        if let Ok(tx_hash) = TxHash::from_str(&query) {
            return Ok(Json(state.history.get_requests_by_tx_hash(tx_hash).await));
        }
        if let Ok(sender) = Address::from_str(&query) {
            return Ok(Json(
                state
                    .history
                    .get_requests_by_sender(sender, query_params.chain_id)
                    .await,
            ));
        }
        if let Ok(sequence_number) = u64::from_str(&query) {
            return Ok(Json(
                state
                    .history
                    .get_requests_by_sequence(sequence_number, query_params.chain_id)
                    .await,
            ));
        }
    }
    //TODO: handle more types of queries
    Ok(Json(vec![]))
}
