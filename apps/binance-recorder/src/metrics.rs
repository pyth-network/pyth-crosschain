use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use prometheus::{
    Counter, CounterVec, Encoder, Gauge, GaugeVec, Histogram, HistogramOpts, Opts, Registry,
    TextEncoder,
};

/// Metrics for the recorder pipeline.
///
/// Covers the queue and ClickHouse-insert surface emitted by the stream worker
/// and writer loop, plus the readiness/liveness surface emitted by the health
/// probe and stream callback: a ClickHouse-up gauge, a ready-state gauge, and a
/// per-symbol last-seen timestamp. `/metrics` exposition is served from
/// [`crate::health`].
#[derive(Clone)]
pub struct RecorderMetrics {
    registry: Registry,
    pub queue_depth: Gauge,
    pub queue_fill_ratio: Gauge,
    pub queue_drops: CounterVec,
    pub insert_attempts: CounterVec,
    pub insert_rows: Counter,
    pub insert_latency_seconds: Histogram,
    pub symbol_last_seen_unix_seconds: GaugeVec,
    pub clickhouse_up: Gauge,
    pub ready_state: Gauge,
}

impl RecorderMetrics {
    pub fn new() -> Result<Self> {
        let registry = Registry::new();

        let queue_depth = Gauge::with_opts(Opts::new(
            "binance_recorder_queue_depth",
            "Current in-memory queue depth",
        ))?;
        let queue_fill_ratio = Gauge::with_opts(Opts::new(
            "binance_recorder_queue_fill_ratio",
            "Current in-memory queue fill ratio",
        ))?;
        let queue_drops = CounterVec::new(
            Opts::new(
                "binance_recorder_queue_drops_total",
                "Total dropped book-ticker updates due to queue saturation",
            ),
            &["symbol"],
        )?;
        let insert_attempts = CounterVec::new(
            Opts::new(
                "binance_recorder_insert_attempts_total",
                "Total ClickHouse insert attempts",
            ),
            &["status"],
        )?;
        let insert_rows = Counter::with_opts(Opts::new(
            "binance_recorder_insert_rows_total",
            "Total rows inserted into ClickHouse",
        ))?;
        let insert_latency_seconds = Histogram::with_opts(
            HistogramOpts::new(
                "binance_recorder_insert_latency_seconds",
                "ClickHouse insert latency in seconds",
            )
            .buckets(vec![0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0]),
        )?;
        let symbol_last_seen_unix_seconds = GaugeVec::new(
            Opts::new(
                "binance_recorder_symbol_last_seen_unix_seconds",
                "Unix timestamp of the last received book-ticker update per symbol",
            ),
            &["symbol"],
        )?;
        let clickhouse_up = Gauge::with_opts(Opts::new(
            "binance_recorder_clickhouse_up",
            "Whether ClickHouse is currently reachable (1/0)",
        ))?;
        let ready_state = Gauge::with_opts(Opts::new(
            "binance_recorder_ready",
            "Readiness status (1=ready, 0=not ready)",
        ))?;

        registry.register(Box::new(queue_depth.clone()))?;
        registry.register(Box::new(queue_fill_ratio.clone()))?;
        registry.register(Box::new(queue_drops.clone()))?;
        registry.register(Box::new(insert_attempts.clone()))?;
        registry.register(Box::new(insert_rows.clone()))?;
        registry.register(Box::new(insert_latency_seconds.clone()))?;
        registry.register(Box::new(symbol_last_seen_unix_seconds.clone()))?;
        registry.register(Box::new(clickhouse_up.clone()))?;
        registry.register(Box::new(ready_state.clone()))?;

        Ok(Self {
            registry,
            queue_depth,
            queue_fill_ratio,
            queue_drops,
            insert_attempts,
            insert_rows,
            insert_latency_seconds,
            symbol_last_seen_unix_seconds,
            clickhouse_up,
            ready_state,
        })
    }

    /// Record a dropped update for `symbol` when the bounded queue is full.
    pub fn record_queue_drop(&self, symbol: &str) {
        self.queue_drops.with_label_values(&[symbol]).inc();
    }

    /// Stamp the per-symbol last-seen gauge when a fresh update is received.
    pub fn record_symbol_seen(&self, symbol: &str) {
        self.symbol_last_seen_unix_seconds
            .with_label_values(&[symbol])
            .set(unix_seconds_now());
    }

    pub fn to_prometheus_payload(&self) -> Result<Vec<u8>> {
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        TextEncoder::new().encode(&metric_families, &mut buffer)?;
        Ok(buffer)
    }
}

fn unix_seconds_now() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}
