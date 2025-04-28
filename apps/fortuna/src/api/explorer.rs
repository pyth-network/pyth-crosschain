use axum::extract::{Path, Query, State};
use axum::Json;
use ethers::types::TxHash;
use utoipa::IntoParams;
use crate::api::{BinaryEncoding, ChainId, GetRandomValueResponse, RestError, RevelationPathParams, RevelationQueryParams};
use crate::chain::reader::BlockNumber;


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
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExplorerQueryParamsMode {
    TxHash,
    ChainAndSequence,
    ChainAndTimestamp,
    Timestamp,
}

#[utoipa::path(
    get,
    path = "/v1/explorer/",
    responses(
(status = 200, description = "Random value successfully retrieved", body = GetRandomValueResponse),
(status = 403, description = "Random value cannot currently be retrieved", body = String)
    ),
    params(ExplorerQueryParams)
)]
pub async fn get_requests(
    State(state): State<crate::api::ApiState>,
    Query(query_params): Query<ExplorerQueryParams>,
) -> anyhow::Result<Json<()>, RestError> {
    match query_params.mode {
        ExplorerQueryParamsMode::TxHash => {
            let tx_hash = query_params.tx_hash.ok_or(RestError::BadFilterParameters("tx_hash is required when mode=tx-hash".to_string()))?;
            state.history.read().await.get_request_logs_by_tx_hash(tx_hash);
        }
        ExplorerQueryParamsMode::ChainAndSequence => {}
        ExplorerQueryParamsMode::ChainAndTimestamp => {}
        ExplorerQueryParamsMode::Timestamp => {}
    };
    Ok(
        Json(()),
    )
}