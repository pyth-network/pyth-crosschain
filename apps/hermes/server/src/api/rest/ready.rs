use {
    crate::{api::ApiState, state::aggregate::Aggregates},
    axum::{
        extract::State,
        http::StatusCode,
        response::{IntoResponse, Response},
        Json,
    },
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
    S: Aggregates,
{
    let state = &*state.state;
    match Aggregates::is_ready(state).await {
        (true, _) => (StatusCode::OK, "OK").into_response(),
        (false, metadata) => (StatusCode::SERVICE_UNAVAILABLE, Json(metadata)).into_response(),
    }
}
