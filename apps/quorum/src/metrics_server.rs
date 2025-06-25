use std::{future::Future, time::Duration};

use axum::{routing::get, Router};
use axum_prometheus::{
    metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle},
    PrometheusMetricLayerBuilder,
};

use crate::server::{wait_for_exit, RunOptions, State};

pub const DEFAULT_METRICS_BUCKET: &[f64; 20] = &[
    0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.25, 1.5, 2.0,
    3.0, 5.0, 10.0,
];

pub fn setup_metrics_recorder() -> anyhow::Result<PrometheusHandle> {
    PrometheusBuilder::new()
        .set_buckets(DEFAULT_METRICS_BUCKET)?
        .install_recorder()
        .map_err(|err| anyhow::anyhow!("Failed to set up metrics recorder: {:?}", err))
}

const METRIC_COLLECTION_INTERVAL: Duration = Duration::from_secs(1);
pub async fn metric_collector<F, Fut>(service_name: String, update_metrics: F)
where
    F: Fn() -> Fut,
    Fut: Future<Output = ()> + Send + 'static,
{
    let mut metric_interval = tokio::time::interval(METRIC_COLLECTION_INTERVAL);
    loop {
        tokio::select! {
            _ = metric_interval.tick() => {
                update_metrics().await;
            }
            _ = wait_for_exit() => {
                tracing::info!("Received exit signal, stopping metric collector for {}...", service_name);
                break;
            }
        }
    }
    tracing::info!("Shutting down metric collector for {}...", service_name);
}

pub async fn run(run_options: RunOptions, state: State) -> anyhow::Result<()> {
    tracing::info!("Starting Metrics Server...");

    let (_, metric_handle) = PrometheusMetricLayerBuilder::new()
        .with_metrics_from_fn(|| state.metrics_recorder.clone())
        .build_pair();
    let app = Router::new();
    let app = app.route("/metrics", get(|| async move { metric_handle.render() }));

    let listener = tokio::net::TcpListener::bind(&run_options.server.metrics_addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = wait_for_exit().await;
            tracing::info!("Shutting down metrics server...");
        })
        .await?;
    Ok(())
}
