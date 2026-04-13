use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use anyhow::Result;
use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::get, Json, Router};
use serde::Serialize;
use tokio::task::JoinHandle;

use crate::metrics::RecorderMetrics;

#[derive(Clone)]
pub struct HealthState {
    expected_symbols: Vec<String>,
    stale_seconds: u64,
    inner: Arc<Mutex<HealthInner>>,
}

#[derive(Default)]
struct HealthInner {
    token_last_poll: HashMap<String, f64>,
    clickhouse_ok: bool,
}

#[derive(Serialize)]
struct ReadyResponse {
    ready: bool,
    clickhouse_ok: bool,
    stale_tokens: Vec<String>,
}

impl HealthState {
    pub fn new(expected_symbols: Vec<String>, stale_seconds: u64) -> Self {
        Self {
            expected_symbols,
            stale_seconds,
            inner: Arc::new(Mutex::new(HealthInner::default())),
        }
    }

    pub fn set_market_seen(&self, symbol: &str) {
        let mut inner = self.inner.lock().expect("health mutex poisoned");
        inner
            .token_last_poll
            .insert(symbol.to_string(), unix_seconds_now());
    }

    pub fn set_clickhouse_ok(&self, healthy: bool) {
        let mut inner = self.inner.lock().expect("health mutex poisoned");
        inner.clickhouse_ok = healthy;
    }

    pub fn is_ready(&self) -> bool {
        self.to_ready_response().ready
    }

    fn to_ready_response(&self) -> ReadyResponse {
        let inner = self.inner.lock().expect("health mutex poisoned");
        let now = unix_seconds_now();
        let stale_tokens = self
            .expected_symbols
            .iter()
            .filter(|symbol| {
                inner
                    .token_last_poll
                    .get(*symbol)
                    .map(|seen| now - *seen > self.stale_seconds as f64)
                    .unwrap_or(true)
            })
            .cloned()
            .collect::<Vec<_>>();

        ReadyResponse {
            ready: inner.clickhouse_ok && stale_tokens.is_empty(),
            clickhouse_ok: inner.clickhouse_ok,
            stale_tokens,
        }
    }
}

#[derive(Clone)]
struct HealthAppState {
    state: HealthState,
}

#[derive(Clone)]
struct MetricsAppState {
    metrics: Arc<RecorderMetrics>,
}

pub fn start_http_servers(
    health_port: u16,
    metrics_port: u16,
    metrics: Arc<RecorderMetrics>,
    state: HealthState,
) -> (JoinHandle<()>, JoinHandle<()>) {
    let health_handle = tokio::spawn(async move {
        if let Err(err) = run_health_server(health_port, state).await {
            tracing::error!("health server failed: {err:?}");
        }
    });

    let metrics_handle = tokio::spawn(async move {
        if let Err(err) = run_metrics_server(metrics_port, metrics).await {
            tracing::error!("metrics server failed: {err:?}");
        }
    });

    (health_handle, metrics_handle)
}

async fn run_health_server(port: u16, state: HealthState) -> Result<()> {
    let app = Router::new()
        .route("/live", get(live_handler))
        .route("/ready", get(ready_handler))
        .with_state(HealthAppState { state });
    axum::Server::bind(&format!("0.0.0.0:{port}").parse()?)
        .serve(app.into_make_service())
        .await?;
    Ok(())
}

async fn run_metrics_server(port: u16, metrics: Arc<RecorderMetrics>) -> Result<()> {
    let app = Router::new()
        .route("/metrics", get(metrics_handler))
        .with_state(MetricsAppState { metrics });
    axum::Server::bind(&format!("0.0.0.0:{port}").parse()?)
        .serve(app.into_make_service())
        .await?;
    Ok(())
}

async fn live_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "live" })),
    )
}

async fn ready_handler(State(app): State<HealthAppState>) -> impl IntoResponse {
    let response = app.state.to_ready_response();
    let status = if response.ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status, Json(response))
}

async fn metrics_handler(State(app): State<MetricsAppState>) -> impl IntoResponse {
    match app.metrics.to_prometheus_payload() {
        Ok(payload) => (
            StatusCode::OK,
            [("content-type", "text/plain; version=0.0.4")],
            payload,
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            [("content-type", "text/plain; charset=utf-8")],
            format!("failed to encode metrics: {err}").into_bytes(),
        )
            .into_response(),
    }
}

fn unix_seconds_now() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs_f64()
}
