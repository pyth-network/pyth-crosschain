use {
    crate::{
        api::ApiState,
        state::aggregate::Aggregates,
    },
    axum::{
        extract::State,
        http::StatusCode,
        response::{
            IntoResponse,
            Response,
        },
    },
};

pub async fn ready<S>(State(state): State<ApiState<S>>) -> Response
where
    S: Aggregates,
{
    let state = &*state.state;
    match Aggregates::is_ready(state).await {
        true => (StatusCode::OK, "OK").into_response(),
        false => (StatusCode::SERVICE_UNAVAILABLE, "Service Unavailable").into_response(),
    }
}
