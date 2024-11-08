use {
    crate::{api::ApiState, state::aggregate::Aggregates},
    axum::{
        extract::State,
        http::StatusCode,
        response::{IntoResponse, Response},
        Json,
    },
};

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
