use {
    crate::{api::ApiState, state::{aggregate::Aggregates, cache::Cache}},
    axum::{
        extract::State,
        http::StatusCode,
        response::{IntoResponse, Response},
        Json,
    },
    serde_json::json,
};

/// Endpoint that returns OK (200) only when the cache is fully hydrated.
///
/// The cache is considered fully hydrated when all of the following conditions are met:
/// - `has_completed_recently`: The latest completed update is recent (within the staleness threshold)
/// - `is_not_behind`: The latest completed slot isn't too far behind the latest observed slot
/// - `is_metadata_loaded`: Price feeds metadata is not empty
///
/// If any of these conditions are not met, the endpoint returns SERVICE_UNAVAILABLE (503)
/// along with detailed metadata about the readiness state.
pub async fn ready<S>(State(state): State<ApiState<S>>) -> Response
where
    S: Aggregates + Cache,
{
    let state = &*state.state;
    let (aggregates_ready, metadata) = Aggregates::is_ready(state).await;
    let cache_ready = Cache::is_ready(state).await;
    
    if aggregates_ready && cache_ready {
        (StatusCode::OK, "OK").into_response()
    } else {
        let response_metadata = json!({
            "aggregates_ready": aggregates_ready,
            "cache_ready": cache_ready,
            "details": metadata
        });
        (StatusCode::SERVICE_UNAVAILABLE, Json(response_metadata)).into_response()
    }
}
