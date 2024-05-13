use {
    crate::api::{
        ChainId,
        RestError,
    },
    anyhow::Result,
    axum::{
        extract::State,
        Json,
    },
    utoipa::ToSchema,
};

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
pub struct RpcHealth {
    chain_id:   ChainId,
    is_healthy: bool,
}

/// Get the list of supported chain ids
#[utoipa::path(
get,
path = "/health",
responses(
(status = 200, description = "Successfully retrieved the list of chain ids", body = RpcHealthResponse),
)
)]
pub async fn health(
    State(state): State<crate::api::ApiState>,
) -> Result<Json<RpcHealthResponse>, RestError> {
    let mut res = RpcHealthResponse {
        rpcs_health: vec![],
    };

    for (chain_id, _) in state.chains.iter() {
        let rpc_health = RpcHealth {
            chain_id:   chain_id.clone(),
            is_healthy: true,
        };

        res.rpcs_health.push(rpc_health);
    }

    Ok(Json(res))
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
pub struct RpcHealthResponse {
    pub rpcs_health: Vec<RpcHealth>,
}
