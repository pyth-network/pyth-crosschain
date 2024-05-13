use {
    crate::{
        api::{
            ChainId,
            RestError,
        },
        chain::reader::BlockStatus,
    },
    anyhow::Result,
    axum::{
        extract::State,
        Json,
    },
    std::sync::{
        Arc,
        RwLock,
    },
    tokio::spawn,
    utoipa::ToSchema,
};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
pub struct RpcHealth {
    chain_id:            ChainId,
    is_healthy:          bool,
    latest_block_number: Option<u64>,
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
    let rpcs_health = Arc::new(RwLock::new(vec![]));

    let threads = state
        .chains
        .iter()
        .map(|(chain_id, _)| {
            let rpcs_health = Arc::clone(&rpcs_health);
            let chain_id = chain_id.clone();
            let contract = Arc::clone(&state.chains.get(&chain_id).unwrap().contract);
            spawn(async move {
                let block_number = match contract.get_block_number(BlockStatus::Latest).await {
                    Ok(number) => Some(number),
                    Err(_) => None,
                };

                let mut rpcs_health = rpcs_health.write().unwrap();
                rpcs_health.push(RpcHealth {
                    chain_id,
                    is_healthy: block_number.is_some(),
                    latest_block_number: block_number,
                });
            })
        })
        .collect::<Vec<_>>();

    // tokio await on threads
    let _ = futures::future::join_all(threads).await;

    let rpcs_health = rpcs_health.read().unwrap().clone();
    Ok(Json(RpcHealthResponse { rpcs_health }))
}

#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema, PartialEq)]
pub struct RpcHealthResponse {
    pub rpcs_health: Vec<RpcHealth>,
}
