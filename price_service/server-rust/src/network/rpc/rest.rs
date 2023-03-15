// This file implements a REST service for the Price Service. This is a mostly direct copy of the
// TypeScript implementation in the `pyth-crosschain` repo. It uses `axum` as the web framework and
// `tokio` as the async runtime.
use {
    anyhow::Result,
    axum::{
        extract::{
            Query,
            State,
        },
        response::IntoResponse,
        Json,
    },
};

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct LatestVaaQueryParams {
    ids: Vec<String>,
}

/// REST endpoint /latest_price_feeds?ids[]=...&ids[]=...&ids[]=...
/// TODO: Replace Infallible with an actual error return type instead of unwrap() crashing the RPC.
pub async fn latest_vaas(
    State(state): State<super::State>,
    Query(params): Query<LatestVaaQueryParams>,
) -> Result<impl IntoResponse, std::convert::Infallible> {
    Ok(Json(state.vaa_cache.latest_for_ids(params.ids)))
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct LastAccsQueryParams {
    id: String,
}

// This function implements the `/live` endpoint. It returns a `200` status code. This endpoint is
// used by the Kubernetes liveness probe.
pub async fn live() -> Result<impl IntoResponse, std::convert::Infallible> {
    Ok(())
}

// This is the index page for the REST service. It will list all the available endpoints.
// TODO: Dynamically generate this list if possible.
pub async fn index() -> impl IntoResponse {
    Json(["/live", "/latest_price_feeds"])
}
