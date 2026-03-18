//! Bulk pusher Prometheus metrics.

use anyhow::Result;
use prometheus::{Counter, CounterVec, Gauge, GaugeVec, Histogram, HistogramOpts, Opts};
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
    pub prices_skipped_total: Counter,
    pub push_queue_depth: Gauge,
    pub push_queue_drops_total: Counter,
    pub push_timeouts_total: Counter,
    pub pusher_instance_info: Gauge,
    pub price_age_seconds: GaugeVec,
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

            bulk_pushes_total: Counter::with_opts(
                Opts::new("bulk_pushes_total", "Push responses received").namespace("lazer_pusher"),
            )
            .expect("failed to create metric"),

            bulk_push_results: CounterVec::new(
                Opts::new("bulk_push_results_total", "Push results by status")
                    .namespace("lazer_pusher"),
                &["status"],
            )
            .expect("failed to create metric"),

            bulk_push_latency: Histogram::with_opts(
                HistogramOpts::new("bulk_push_latency_seconds", "Push latency")
                    .namespace("lazer_pusher")
                    .buckets(vec![0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0]),
            )
            .expect("failed to create metric"),

            bulk_connections_active: Gauge::with_opts(
                Opts::new("bulk_connections_active", "Connected validator endpoints")
                    .namespace("lazer_pusher"),
            )
            .expect("failed to create metric"),

            prices_skipped_total: Counter::with_opts(
                Opts::new(
                    "prices_skipped_total",
                    "Push cycles skipped due to no prices or no valid oracles",
                )
                .namespace("lazer_pusher"),
            )
            .expect("failed to create metric"),

            push_queue_depth: Gauge::with_opts(
                Opts::new("push_queue_depth", "Current transaction queue depth")
                    .namespace("lazer_pusher"),
            )
            .expect("failed to create metric"),

            push_queue_drops_total: Counter::with_opts(
                Opts::new(
                    "push_queue_drops_total",
                    "Transactions dropped due to full queue",
                )
                .namespace("lazer_pusher"),
            )
            .expect("failed to create metric"),

            push_timeouts_total: Counter::with_opts(
                Opts::new("push_timeouts_total", "Push response timeouts")
                    .namespace("lazer_pusher"),
            )
            .expect("failed to create metric"),

            pusher_instance_info: Gauge::with_opts(
                Opts::new(
                    "pusher_instance_info",
                    "Always 1; sum to count active pusher instances",
                )
                .namespace("lazer_pusher"),
            )
            .expect("failed to create metric"),

            price_age_seconds: GaugeVec::new(
                Opts::new("price_age_seconds", "Age of price at push time")
                    .namespace("lazer_pusher"),
                &["feed_id"],
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
        registry.register(Box::new(self.prices_skipped_total.clone()))?;
        registry.register(Box::new(self.push_queue_depth.clone()))?;
        registry.register(Box::new(self.push_queue_drops_total.clone()))?;
        registry.register(Box::new(self.push_timeouts_total.clone()))?;
        registry.register(Box::new(self.pusher_instance_info.clone()))?;
        registry.register(Box::new(self.price_age_seconds.clone()))?;
        self.pusher_instance_info.set(1.0);
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

pub fn record_prices_skipped() {
    metrics().prices_skipped_total.inc();
}

#[allow(clippy::cast_precision_loss, reason = "queue depth fits in f64")]
pub fn set_push_queue_depth(depth: usize) {
    metrics().push_queue_depth.set(depth as f64);
}

pub fn record_push_queue_drop() {
    metrics().push_queue_drops_total.inc();
}

pub fn record_push_timeout() {
    let m = metrics();
    m.bulk_pushes_total.inc();
    m.push_timeouts_total.inc();
}

#[allow(
    clippy::cast_possible_truncation,
    reason = "milliseconds since epoch fits in u64 for many millennia"
)]
pub fn record_price_ages(prices: &[pusher_base::CachedPrice]) {
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let m = metrics();
    for price in prices {
        let age_secs = now_ms.saturating_sub(price.timestamp_ms) as f64 / 1000.0;
        m.price_age_seconds
            .with_label_values(&[&price.feed_id.0.to_string()])
            .set(age_secs);
    }
}

pub fn base_metrics() -> &'static BaseMetrics {
    &metrics().base
}
