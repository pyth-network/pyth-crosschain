use {
    axum::{body::Body, routing::get, Router},
    index::index,
    live::live,
    metrics::metrics,
    prometheus_client::registry::Registry,
    ready::ready,
    std::sync::Arc,
    tokio::sync::RwLock,
};
mod index;
mod live;
mod metrics;
mod ready;
#[derive(Clone)]
pub struct ApiState {
    pub metrics_registry: Arc<RwLock<Registry>>,
}

pub fn routes(api_state: ApiState) -> Router<(), Body> {
    Router::new()
        .route("/", get(index))
        .route("/live", get(live))
        .route("/ready", get(ready))
        .route("/metrics", get(metrics))
        .with_state(api_state)
}
