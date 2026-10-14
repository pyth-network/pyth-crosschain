use {
    crate::api::{ChainId, RestError},
    anyhow::Result,
    axum::{extract::State, Json},
    utoipa::ToSchema,
};

/// Response containing the list of supported chain IDs
#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct GetChainIdsResponse(
    /// List of supported blockchain identifiers
    #[schema(example = json!(["ethereum", "avalanche", "arbitrum", "optimism"]))]
    Vec<ChainId>,
);

/// Get the list of supported chain ids
///
/// Returns all blockchain identifiers that this Fortuna instance supports.
/// Each chain_id can be used in other API endpoints to specify which blockchain to interact with.
#[utoipa::path(
get,
path = "/v1/chains",
responses(
(status = 200, description = "Successfully retrieved the list of chain ids", body = [String],
    example = json!(["ethereum", "avalanche", "arbitrum", "optimism"])
),
)
)]
pub async fn chain_ids(
    State(state): State<crate::api::ApiState>,
) -> Result<Json<Vec<ChainId>>, RestError> {
    let chain_ids = state.chains.read().await.keys().cloned().collect();
    Ok(Json(chain_ids))
}
