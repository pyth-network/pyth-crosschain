use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use anyhow::Result;
use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::get, Json, Router};
use serde::Serialize;
use tokio::task::JoinHandle;

use crate::metrics::RecorderMetrics;

#[derive(Clone)]
pub struct HealthState {
    expected_coins: Vec<String>,
    stale_seconds: u64,
    funding_poll_seconds: u64,
    funding_stale_seconds: u64,
    started_at: Instant,
    inner: Arc<Mutex<HealthInner>>,
}

#[derive(Default)]
struct HealthInner {
    market_last_message: HashMap<String, f64>,
    funding_last_event_ms: HashMap<String, u64>,
    clickhouse_ok: bool,
}

#[derive(Serialize)]
struct ReadyResponse {
    ready: bool,
    clickhouse_ok: bool,
    stale_markets: Vec<String>,
    stale_funding_markets: Vec<String>,
}

impl HealthState {
    pub fn new(
        expected_coins: Vec<String>,
        stale_seconds: u64,
        funding_poll_seconds: u64,
        funding_stale_seconds: u64,
    ) -> Self {
        Self {
            expected_coins,
            stale_seconds,
            funding_poll_seconds,
            funding_stale_seconds,
            started_at: Instant::now(),
            inner: Arc::new(Mutex::new(HealthInner::default())),
        }
    }

    pub fn set_market_seen(&self, coin: &str) {
        let mut inner = self.inner.lock().expect("health mutex poisoned");
        inner
            .market_last_message
            .insert(coin.to_string(), unix_seconds_now());
    }

    pub fn set_funding_event_seen(&self, coin: &str, funding_time_ms: u64) {
        let mut inner = self.inner.lock().expect("health mutex poisoned");
        inner
            .funding_last_event_ms
            .insert(coin.to_string(), funding_time_ms);
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
        let elapsed_secs = self.started_at.elapsed().as_secs();
        let grace_secs = self.funding_poll_seconds.saturating_mul(2);

        let stale_markets = self
            .expected_coins
            .iter()
            .filter(|coin| {
                inner
                    .market_last_message
                    .get(*coin)
                    .map(|seen| now - *seen > self.stale_seconds as f64)
                    .unwrap_or(true)
            })
            .cloned()
            .collect::<Vec<_>>();

        let now_ms = (now * 1000.0) as u64;
        let stale_funding_markets = self
            .expected_coins
            .iter()
            .filter(|coin| match inner.funding_last_event_ms.get(*coin) {
                Some(event_ms) => {
                    now_ms.saturating_sub(*event_ms) / 1000 > self.funding_stale_seconds
                }
                None => elapsed_secs >= grace_secs,
            })
            .cloned()
            .collect::<Vec<_>>();

        ReadyResponse {
            ready: inner.clickhouse_ok
                && stale_markets.is_empty()
                && stale_funding_markets.is_empty(),
            clickhouse_ok: inner.clickhouse_ok,
            stale_markets,
            stale_funding_markets,
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
