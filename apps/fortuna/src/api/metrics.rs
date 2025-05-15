//! Exposing prometheus metrics via HTTP in openmetrics format.

use {
    axum::{extract::State, response::IntoResponse},
    prometheus_client::encoding::text::encode,
};

pub async fn metrics(State(state): State<crate::api::ApiState>) -> impl IntoResponse {
    let registry = state.metrics_registry.read().await;
    let mut buffer = String::new();

    // Should not fail if the metrics are valid and there is memory available
    // to write to the buffer.
    if let Err(e) = encode(&mut buffer, &registry) {
        tracing::error!("Failed to encode metrics: {}", e);
        return axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }

    buffer.into_response()
}
