//! Health endpoint for Kubernetes readiness/liveness probes.
//!
//! The pusher is considered ready when:
//! - All configured feeds have received at least MIN_UPDATES_PER_FEED updates
//! - At least one delivery endpoint is connected
//!
//! Health status is determined by reading prometheus metrics.

use crate::metrics;
use axum::{extract::State, http::StatusCode, routing::get, Router};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{info, warn};

/// Minimum number of updates per feed before the pusher is considered ready.
const MIN_UPDATES_PER_FEED: u64 = 5;

/// Health check result.
#[derive(Debug)]
pub struct HealthStatus {
    pub ready: bool,
    pub feeds_ready: usize,
    pub feeds_total: usize,
    pub endpoints_connected: usize,
}

/// Check health status by reading prometheus metrics.
pub fn check_health(required_feeds: &[u32]) -> HealthStatus {
    let m = metrics::metrics();

    // Check how many feeds have enough updates
    let mut feeds_ready = 0;
    for feed_id in required_feeds {
        let count = m
            .base
            .lazer_updates_received
            .with_label_values(&[&feed_id.to_string()])
            .get();

        #[allow(
            clippy::cast_sign_loss,
            clippy::cast_possible_truncation,
            reason = "counter value is always non-negative and fits in u64"
        )]
        if count as u64 >= MIN_UPDATES_PER_FEED {
            feeds_ready += 1;
        }
    }

    // Check delivery connections
    #[allow(
        clippy::cast_sign_loss,
        clippy::cast_possible_truncation,
        reason = "gauge value represents a count"
    )]
    let endpoints_connected = m.bulk_connections_active.get() as usize;

    let ready = feeds_ready == required_feeds.len() && endpoints_connected > 0;

    HealthStatus {
        ready,
        feeds_ready,
        feeds_total: required_feeds.len(),
        endpoints_connected,
    }
}

/// Start the health HTTP server.
pub async fn start_health_server(address: SocketAddr, required_feeds: Vec<u32>) {
    let feeds: Arc<[u32]> = required_feeds.into();

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/live", get(live_handler))
        .with_state(feeds);

    info!(%address, "starting health server");

    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(l) => l,
        Err(e) => {
            warn!(?e, "failed to bind health server");
            return;
        }
    };

    if let Err(e) = axum::serve(listener, app).await {
        warn!(?e, "health server error");
    }
}

/// Health/readiness endpoint - returns 200 only when ready.
async fn health_handler(State(feeds): State<Arc<[u32]>>) -> (StatusCode, String) {
    let status = check_health(&feeds);
    let code = if status.ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    let body = format!(
        r#"{{"ready":{},"feeds_ready":{},"feeds_total":{},"endpoints_connected":{}}}"#,
        status.ready, status.feeds_ready, status.feeds_total, status.endpoints_connected
    );

    (code, body)
}

/// Liveness probe - always returns 200 (process is alive).
async fn live_handler() -> StatusCode {
    StatusCode::OK
}
