use {
    crate::api::{ChainId, RestError},
    anyhow::Result,
    axum::{extract::State, Json},
};

/// Get the list of supported chain ids
#[utoipa::path(
get,
path = "/v1/chains",
responses(
(status = 200, description = "Successfully retrieved the list of chain ids", body = GetRandomValueResponse),
)
)]
pub async fn chain_ids(
    State(state): State<crate::api::ApiState>,
) -> Result<Json<Vec<ChainId>>, RestError> {
    let chain_ids = state
        .chains
        .read()
        .await
        .iter()
        .map(|(id, _)| id.clone())
        .collect();
    Ok(Json(chain_ids))
}
