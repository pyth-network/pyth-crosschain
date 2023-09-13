use axum::{
    extract::State,
    http::StatusCode,
    response::{
        IntoResponse,
        Response,
    },
};

pub async fn ready(State(state): State<crate::api::State>) -> Response {
    match crate::store::is_ready(&state.store).await {
        true => (StatusCode::OK, "OK").into_response(),
        false => (StatusCode::SERVICE_UNAVAILABLE, "Service Unavailable").into_response(),
    }
}
