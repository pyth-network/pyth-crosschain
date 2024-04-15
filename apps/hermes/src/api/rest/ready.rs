use axum::{
    extract::State,
    http::StatusCode,
    response::{
        IntoResponse,
        Response,
    },
};

pub async fn ready(State(state): State<crate::api::ApiState>) -> Response {
    match crate::aggregate::is_ready(&state.state).await {
        true => (StatusCode::OK, "OK").into_response(),
        false => (StatusCode::SERVICE_UNAVAILABLE, "Service Unavailable").into_response(),
    }
}
