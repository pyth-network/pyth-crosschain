use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

pub async fn live() -> Response {
    (StatusCode::OK, "OK").into_response()
}
