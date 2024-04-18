//! Metrics Server
//!
//! This server serves metrics over /metrics in OpenMetrics format.

use {
    crate::{
        config::RunOptions,
        state::State as AppState,
    },
    anyhow::Result,
    axum::{
        extract::State,
        http::header,
        response::IntoResponse,
        routing::get,
        Router,
    },
    prometheus_client::encoding::text::encode,
    std::sync::Arc,
};


#[tracing::instrument(skip(opts, state))]
pub async fn run(opts: RunOptions, state: Arc<AppState>) -> Result<()> {
    tracing::info!(endpoint = %opts.metrics.server_listen_addr, "Starting Metrics Server.");

    let app = Router::new();
    let app = app
        .route("/metrics", get(metrics))
        .with_state(state.clone());

    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    axum::Server::try_bind(&opts.metrics.server_listen_addr)?
        .serve(app.into_make_service())
        .with_graceful_shutdown(async {
            let _ = crate::EXIT.subscribe().changed().await;
            tracing::info!("Shutting down metrics server...");
        })
        .await?;

    Ok(())
}

pub async fn metrics(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let registry = state.metrics_registry.read().await;
    let mut buffer = String::new();

    // Should not fail if the metrics are valid and there is memory available
    // to write to the buffer.
    encode(&mut buffer, &registry).unwrap();

    (
        [(
            header::CONTENT_TYPE,
            "application/openmetrics-text; version=1.0.0; charset=utf-8",
        )],
        buffer,
    )
}
