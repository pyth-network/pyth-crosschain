//! API server for Prometheus metrics and health checks

use {
    anyhow::{anyhow, Result},
    axum::{body::Body, routing::get, Router},
    index::index,
    live::live,
    metrics::metrics,
    prometheus_client::registry::Registry,
    ready::ready,
    std::{net::SocketAddr, sync::Arc},
    tokio::sync::{watch, RwLock},
    tower_http::cors::CorsLayer,
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

pub async fn run_api_server(
    socket_addr: SocketAddr,
    metrics_registry: Arc<RwLock<Registry>>,
    mut exit_rx: watch::Receiver<bool>,
) -> Result<()> {
    let api_state = ApiState {
        metrics_registry: metrics_registry.clone(),
    };

    let app = Router::new();
    let app = app
        .merge(routes(api_state))
        // Permissive CORS layer to allow all origins
        .layer(CorsLayer::permissive());

    tracing::info!("Starting API server on: {:?}", &socket_addr);
    axum::Server::try_bind(&socket_addr)
        .map_err(|e| anyhow!("Failed to bind to address {}: {}", &socket_addr, e))?
        .serve(app.into_make_service())
        .with_graceful_shutdown(async {
            // Ctrl+c signal received
            let _ = exit_rx.changed().await;

            tracing::info!("Shutting down API server...");
        })
        .await?;

    Ok(())
}
