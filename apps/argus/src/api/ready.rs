use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

pub async fn ready() -> Response {
    // TODO: are there useful checks here? At the moment, everything important occurs synchronously on startup.
    (StatusCode::OK, "OK").into_response()
}
