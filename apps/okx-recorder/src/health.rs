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

/// Readiness state shared between the data path and the `/ready` probe.
///
/// Mirrors `binance-recorder`'s `HealthState`, keyed by OKX instrument id.
/// `/ready` gates on exactly two signals: ClickHouse reachability and
/// per-instrument ToB freshness. Future trades/funding lanes expose
/// last-event-age metrics but NEVER gate readiness — trades can legitimately go
/// quiet and funding only updates on a slow cadence, so their staleness is an
/// observability signal, not an outage. An instrument that never streams (e.g.
/// one that isn't listed on OKX) surfaces as perpetual staleness here rather
/// than as a crash.
#[derive(Clone)]
pub struct HealthState {
    expected_instruments: Vec<String>,
    stale_seconds: u64,
    inner: Arc<Mutex<HealthInner>>,
}

#[derive(Default)]
struct HealthInner {
    instrument_last_seen: HashMap<String, f64>,
    clickhouse_ok: bool,
}

#[derive(Serialize)]
struct ReadyResponse {
    ready: bool,
    clickhouse_ok: bool,
    stale_instruments: Vec<String>,
}

impl HealthState {
    pub fn new(expected_instruments: Vec<String>, stale_seconds: u64) -> Self {
        Self {
            expected_instruments,
            stale_seconds,
            inner: Arc::new(Mutex::new(HealthInner::default())),
        }
    }

    /// Record that a fresh ToB update was received for `inst_id`.
    pub fn set_instrument_seen(&self, inst_id: &str) {
        let mut inner = self.inner.lock().expect("health mutex poisoned");
        inner
            .instrument_last_seen
            .insert(inst_id.to_string(), unix_seconds_now());
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
        let stale_instruments = self
            .expected_instruments
            .iter()
            .filter(|inst_id| {
                inner
                    .instrument_last_seen
                    .get(*inst_id)
                    .map(|seen| now - *seen > self.stale_seconds as f64)
                    .unwrap_or(true)
            })
            .cloned()
            .collect::<Vec<_>>();

        ReadyResponse {
            ready: inner.clickhouse_ok && stale_instruments.is_empty(),
            clickhouse_ok: inner.clickhouse_ok,
            stale_instruments,
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
