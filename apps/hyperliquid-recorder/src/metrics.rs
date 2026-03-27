use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use prometheus::{
    Counter, CounterVec, Encoder, Gauge, GaugeVec, Histogram, HistogramOpts, Opts, Registry,
    TextEncoder,
};

use crate::models::L2Snapshot;

#[derive(Clone)]
pub struct RecorderMetrics {
    registry: Registry,
    pub stream_messages: CounterVec,
    pub stream_reconnects: CounterVec,
    pub stream_errors: CounterVec,
    pub market_last_message_unix_seconds: GaugeVec,
    pub market_last_block_number: GaugeVec,
    pub market_last_block_time_ms: GaugeVec,
    pub market_snapshot_levels: GaugeVec,
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

        let stream_messages = CounterVec::new(
            Opts::new(
                "hyperliquid_recorder_stream_messages_total",
                "Total L2 snapshots received from stream",
            ),
            &["coin"],
        )?;
        let stream_reconnects = CounterVec::new(
            Opts::new(
                "hyperliquid_recorder_stream_reconnects_total",
                "Total reconnect attempts by market",
            ),
            &["coin", "reason"],
        )?;
        let stream_errors = CounterVec::new(
            Opts::new(
                "hyperliquid_recorder_stream_errors_total",
                "Total stream errors by market",
            ),
            &["coin", "code"],
        )?;
        let market_last_message_unix_seconds = GaugeVec::new(
            Opts::new(
                "hyperliquid_recorder_market_last_message_unix_seconds",
                "Unix timestamp for last received market message",
            ),
            &["coin"],
        )?;
        let market_last_block_number = GaugeVec::new(
            Opts::new(
                "hyperliquid_recorder_market_last_block_number",
                "Last observed block number per market",
            ),
            &["coin"],
        )?;
        let market_last_block_time_ms = GaugeVec::new(
            Opts::new(
                "hyperliquid_recorder_market_last_block_time_ms",
                "Last observed block timestamp from stream (milliseconds)",
            ),
            &["coin"],
        )?;
        let market_snapshot_levels = GaugeVec::new(
            Opts::new(
                "hyperliquid_recorder_market_snapshot_levels",
                "Snapshot levels observed per side",
            ),
            &["coin", "side"],
        )?;
        let queue_depth = Gauge::with_opts(Opts::new(
            "hyperliquid_recorder_queue_depth",
            "Current in-memory queue depth",
        ))?;
        let queue_fill_ratio = Gauge::with_opts(Opts::new(
            "hyperliquid_recorder_queue_fill_ratio",
            "Current in-memory queue fill ratio",
        ))?;
        let queue_drops = CounterVec::new(
            Opts::new(
                "hyperliquid_recorder_queue_drops_total",
                "Total dropped snapshots due to queue saturation",
            ),
            &["coin"],
        )?;
        let insert_attempts = CounterVec::new(
            Opts::new(
                "hyperliquid_recorder_insert_attempts_total",
                "Total ClickHouse insert attempts",
            ),
            &["status"],
        )?;
        let insert_rows = Counter::with_opts(Opts::new(
            "hyperliquid_recorder_insert_rows_total",
            "Total rows inserted into ClickHouse",
        ))?;
        let insert_latency_seconds = Histogram::with_opts(
            HistogramOpts::new(
                "hyperliquid_recorder_insert_latency_seconds",
                "ClickHouse insert latency in seconds",
            )
            .buckets(vec![0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0]),
        )?;
        let clickhouse_up = Gauge::with_opts(Opts::new(
            "hyperliquid_recorder_clickhouse_up",
            "Whether ClickHouse is currently reachable (1/0)",
        ))?;
        let ready_state = Gauge::with_opts(Opts::new(
            "hyperliquid_recorder_ready",
            "Readiness status (1=ready, 0=not ready)",
        ))?;

        registry.register(Box::new(stream_messages.clone()))?;
        registry.register(Box::new(stream_reconnects.clone()))?;
        registry.register(Box::new(stream_errors.clone()))?;
        registry.register(Box::new(market_last_message_unix_seconds.clone()))?;
        registry.register(Box::new(market_last_block_number.clone()))?;
        registry.register(Box::new(market_last_block_time_ms.clone()))?;
        registry.register(Box::new(market_snapshot_levels.clone()))?;
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
            stream_messages,
            stream_reconnects,
            stream_errors,
            market_last_message_unix_seconds,
            market_last_block_number,
            market_last_block_time_ms,
            market_snapshot_levels,
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

    pub fn record_snapshot(&self, snapshot: &L2Snapshot) {
        self.stream_messages
            .with_label_values(&[&snapshot.coin])
            .inc();
        self.market_last_message_unix_seconds
            .with_label_values(&[&snapshot.coin])
            .set(unix_seconds_now());
        self.market_last_block_number
            .with_label_values(&[&snapshot.coin])
            .set(snapshot.block_number as f64);
        self.market_last_block_time_ms
            .with_label_values(&[&snapshot.coin])
            .set(snapshot.block_time_ms as f64);
        self.market_snapshot_levels
            .with_label_values(&[&snapshot.coin, "bids"])
            .set(snapshot.bids.len() as f64);
        self.market_snapshot_levels
            .with_label_values(&[&snapshot.coin, "asks"])
            .set(snapshot.asks.len() as f64);
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
