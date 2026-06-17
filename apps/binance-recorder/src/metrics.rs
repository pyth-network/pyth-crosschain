use anyhow::Result;
use prometheus::{
    Counter, CounterVec, Encoder, Gauge, Histogram, HistogramOpts, Opts, Registry, TextEncoder,
};

/// Write-path metrics for the recorder pipeline.
///
/// This slice covers the queue and ClickHouse-insert surface that the stream
/// worker and writer loop emit. The readiness/liveness gauges (ClickHouse-up,
/// ready state, per-symbol last-seen) and the `/metrics` HTTP exposition land
/// with the health surface in a later slice; the registry and
/// [`to_prometheus_payload`](RecorderMetrics::to_prometheus_payload) are wired
/// here so that addition is purely additive.
#[derive(Clone)]
pub struct RecorderMetrics {
    registry: Registry,
    pub queue_depth: Gauge,
    pub queue_fill_ratio: Gauge,
    pub queue_drops: CounterVec,
    pub insert_attempts: CounterVec,
    pub insert_rows: Counter,
    pub insert_latency_seconds: Histogram,
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

        registry.register(Box::new(queue_depth.clone()))?;
        registry.register(Box::new(queue_fill_ratio.clone()))?;
        registry.register(Box::new(queue_drops.clone()))?;
        registry.register(Box::new(insert_attempts.clone()))?;
        registry.register(Box::new(insert_rows.clone()))?;
        registry.register(Box::new(insert_latency_seconds.clone()))?;

        Ok(Self {
            registry,
            queue_depth,
            queue_fill_ratio,
            queue_drops,
            insert_attempts,
            insert_rows,
            insert_latency_seconds,
        })
    }

    /// Record a dropped update for `symbol` when the bounded queue is full.
    pub fn record_queue_drop(&self, symbol: &str) {
        self.queue_drops.with_label_values(&[symbol]).inc();
    }

    pub fn to_prometheus_payload(&self) -> Result<Vec<u8>> {
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        TextEncoder::new().encode(&metric_families, &mut buffer)?;
        Ok(buffer)
    }
}
