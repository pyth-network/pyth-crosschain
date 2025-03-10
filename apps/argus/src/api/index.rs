use axum::{response::IntoResponse, Json};

/// This is the index page for the REST service. It lists all the available endpoints.
///
/// TODO: Dynamically generate this list if possible.
pub async fn index() -> impl IntoResponse {
    Json([
        "/",
        "/live",
        "/metrics",
        "/ready",
        "/v1/chains",
        "/v1/chains/:chain_id/price-updates/:sequence"
    ])
}
