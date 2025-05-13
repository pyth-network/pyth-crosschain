use crate::api::{ChainId, RestError};
use crate::history::RequestStatus;
use axum::extract::{Query, State};
use axum::Json;
use ethers::types::TxHash;
use utoipa::{IntoParams, ToSchema};

#[derive(Debug, serde::Serialize, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct ExplorerQueryParams {
    pub mode: ExplorerQueryParamsMode,

    pub min_timestamp: Option<u64>,
    pub max_timestamp: Option<u64>,
    pub sequence_id: Option<u64>,
    #[param(value_type = Option<String>)]
    pub tx_hash: Option<TxHash>,
    #[param(value_type = Option<String>)]
    pub chain_id: Option<ChainId>,
}
#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum ExplorerQueryParamsMode {
    TxHash,
    ChainAndSequence,
    ChainAndTimestamp,
    Timestamp,
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
    let result = match query_params.mode {
        ExplorerQueryParamsMode::TxHash => {
            let tx_hash = query_params.tx_hash.ok_or(RestError::BadFilterParameters(
                "tx_hash is required when mode=tx-hash".to_string(),
            ))?;
            state.history.get_request_logs_by_tx_hash(tx_hash).await
        }
        ExplorerQueryParamsMode::ChainAndSequence => {
            let chain_id = query_params.chain_id.ok_or(RestError::BadFilterParameters(
                "chain_id is required when mode=chain-and-sequence".to_string(),
            ))?;
            let sequence_id = query_params
                .sequence_id
                .ok_or(RestError::BadFilterParameters(
                    "sequence_id is required when mode=chain-and-sequence".to_string(),
                ))?;
            state
                .history
                .get_request_logs(&(chain_id, sequence_id))
                .await
                .into_iter()
                .collect()
        }
        ExplorerQueryParamsMode::ChainAndTimestamp => {
            vec![]
        }
        ExplorerQueryParamsMode::Timestamp => {
            vec![]
        }
    };
    Ok(Json(result))
}
