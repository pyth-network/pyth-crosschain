use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use prometheus::{
    Counter, CounterVec, Encoder, Gauge, GaugeVec, Histogram, HistogramOpts, Opts, Registry,
    TextEncoder,
};

use crate::models::OndoQuote;

#[derive(Clone)]
pub struct RecorderMetrics {
    registry: Registry,
    pub poll_requests: CounterVec,
    pub poll_latency_seconds: Histogram,
    pub poll_errors: CounterVec,
    pub token_last_poll_unix_seconds: GaugeVec,
    pub queue_depth: Gauge,
    pub queue_fill_ratio: Gauge,
    pub queue_drops: CounterVec,
    pub insert_attempts: CounterVec,
    pub insert_rows: Counter,
    pub insert_latency_seconds: Histogram,
    pub clickhouse_up: Gauge,
    pub ready_state: Gauge,
}

impl RecorderMetrics {
    pub fn new() -> Result<Self> {
        let registry = Registry::new();

        let poll_requests = CounterVec::new(
            Opts::new(
                "ondo_recorder_poll_requests_total",
                "Total API poll requests",
            ),
            &["symbol", "chain", "side", "size", "status"],
        )?;
        let poll_latency_seconds = Histogram::with_opts(
            HistogramOpts::new(
                "ondo_recorder_poll_latency_seconds",
                "API poll latency in seconds",
            )
            .buckets(vec![0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0]),
        )?;
        let poll_errors = CounterVec::new(
            Opts::new("ondo_recorder_poll_errors_total", "Total API poll errors"),
            &["symbol", "chain", "error_type"],
        )?;
        let token_last_poll_unix_seconds = GaugeVec::new(
            Opts::new(
                "ondo_recorder_token_last_poll_unix_seconds",
                "Unix timestamp of last successful poll per token",
            ),
            &["symbol", "chain"],
        )?;
        let queue_depth = Gauge::with_opts(Opts::new(
            "ondo_recorder_queue_depth",
            "Current in-memory queue depth",
        ))?;
        let queue_fill_ratio = Gauge::with_opts(Opts::new(
            "ondo_recorder_queue_fill_ratio",
            "Current in-memory queue fill ratio",
        ))?;
        let queue_drops = CounterVec::new(
            Opts::new(
                "ondo_recorder_queue_drops_total",
                "Total dropped quotes due to queue saturation",
            ),
            &["symbol", "chain"],
        )?;
        let insert_attempts = CounterVec::new(
            Opts::new(
                "ondo_recorder_insert_attempts_total",
                "Total ClickHouse insert attempts",
            ),
            &["status"],
        )?;
        let insert_rows = Counter::with_opts(Opts::new(
            "ondo_recorder_insert_rows_total",
            "Total rows inserted into ClickHouse",
        ))?;
        let insert_latency_seconds = Histogram::with_opts(
            HistogramOpts::new(
                "ondo_recorder_insert_latency_seconds",
                "ClickHouse insert latency in seconds",
            )
            .buckets(vec![0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0]),
        )?;
        let clickhouse_up = Gauge::with_opts(Opts::new(
            "ondo_recorder_clickhouse_up",
            "Whether ClickHouse is currently reachable (1/0)",
        ))?;
        let ready_state = Gauge::with_opts(Opts::new(
            "ondo_recorder_ready",
            "Readiness status (1=ready, 0=not ready)",
        ))?;

        registry.register(Box::new(poll_requests.clone()))?;
        registry.register(Box::new(poll_latency_seconds.clone()))?;
        registry.register(Box::new(poll_errors.clone()))?;
        registry.register(Box::new(token_last_poll_unix_seconds.clone()))?;
        registry.register(Box::new(queue_depth.clone()))?;
        registry.register(Box::new(queue_fill_ratio.clone()))?;
        registry.register(Box::new(queue_drops.clone()))?;
        registry.register(Box::new(insert_attempts.clone()))?;
        registry.register(Box::new(insert_rows.clone()))?;
        registry.register(Box::new(insert_latency_seconds.clone()))?;
        registry.register(Box::new(clickhouse_up.clone()))?;
        registry.register(Box::new(ready_state.clone()))?;

        Ok(Self {
            registry,
            poll_requests,
            poll_latency_seconds,
            poll_errors,
            token_last_poll_unix_seconds,
            queue_depth,
            queue_fill_ratio,
            queue_drops,
            insert_attempts,
            insert_rows,
            insert_latency_seconds,
            clickhouse_up,
            ready_state,
        })
    }

    pub fn record_quote(&self, quote: &OndoQuote) {
        self.poll_requests
            .with_label_values(&[
                &quote.symbol,
                &quote.chain_id,
                &quote.side,
                &quote.token_amount.normalize().to_string(),
                "success",
            ])
            .inc();
        self.token_last_poll_unix_seconds
            .with_label_values(&[&quote.symbol, &quote.chain_id])
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
