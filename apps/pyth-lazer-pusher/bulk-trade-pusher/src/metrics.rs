//! Bulk pusher Prometheus metrics.

use anyhow::Result;
use prometheus::{Counter, CounterVec, Gauge, Histogram, HistogramOpts, Opts};
use pusher_base::BaseMetrics;
use std::net::SocketAddr;
use std::sync::OnceLock;
use websocket_delivery::DeliveryMetrics;

static METRICS: OnceLock<BulkMetrics> = OnceLock::new();

pub fn metrics() -> &'static BulkMetrics {
    METRICS.get_or_init(BulkMetrics::new)
}

pub struct BulkMetrics {
    pub base: BaseMetrics,
    pub ws: DeliveryMetrics,
    pub bulk_pushes_total: Counter,
    pub bulk_push_results: CounterVec,
    pub bulk_push_latency: Histogram,
    pub bulk_connections_active: Gauge,
}

impl BulkMetrics {
    #[allow(
        clippy::expect_used,
        reason = "metric creation with static strings cannot fail"
    )]
    fn new() -> Self {
        Self {
            base: BaseMetrics::new("bulk-trade"),
            ws: DeliveryMetrics::new("bulk-trade"),

            bulk_pushes_total: Counter::new("bulk_pushes_total", "Push responses received")
                .expect("failed to create metric"),

            bulk_push_results: CounterVec::new(
                Opts::new("bulk_push_results_total", "Push results by status"),
                &["status"],
            )
            .expect("failed to create metric"),

            bulk_push_latency: Histogram::with_opts(
                HistogramOpts::new("bulk_push_latency_seconds", "Push latency")
                    .buckets(vec![0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0]),
            )
            .expect("failed to create metric"),

            bulk_connections_active: Gauge::new(
                "bulk_connections_active",
                "Connected validator endpoints",
            )
            .expect("failed to create metric"),
        }
    }

    fn register(&self) -> Result<()> {
        let registry = prometheus::default_registry();
        self.base.register(registry)?;
        self.ws.register(registry)?;
        registry.register(Box::new(self.bulk_pushes_total.clone()))?;
        registry.register(Box::new(self.bulk_push_results.clone()))?;
        registry.register(Box::new(self.bulk_push_latency.clone()))?;
        registry.register(Box::new(self.bulk_connections_active.clone()))?;
        Ok(())
    }
}

pub fn ws_metrics() -> DeliveryMetrics {
    metrics().ws.clone()
}

pub fn init_metrics(address: SocketAddr) -> Result<()> {
    metrics().register()?;
    pusher_base::init_prometheus_exporter(address)?;
    Ok(())
}

pub fn record_push_success(latency_secs: f64) {
    let m = metrics();
    m.bulk_pushes_total.inc();
    m.bulk_push_results.with_label_values(&["accepted"]).inc();
    m.bulk_push_latency.observe(latency_secs);
    m.base.update_last_push_timestamp();
}

pub fn record_push_dedup() {
    let m = metrics();
    m.bulk_pushes_total.inc();
    m.bulk_push_results
        .with_label_values(&["deduplicated"])
        .inc();
}

pub fn record_push_error() {
    let m = metrics();
    m.bulk_pushes_total.inc();
    m.bulk_push_results.with_label_values(&["error"]).inc();
}

#[allow(clippy::cast_precision_loss, reason = "connection count fits in f64")]
pub fn update_bulk_connections(count: usize) {
    metrics().bulk_connections_active.set(count as f64);
}

pub fn set_batch_size(size: usize) {
    metrics().base.set_batch_size(size);
}

pub fn base_metrics() -> &'static BaseMetrics {
    &metrics().base
}
