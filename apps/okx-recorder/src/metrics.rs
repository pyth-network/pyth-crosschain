use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use prometheus::{
    Counter, CounterVec, Encoder, Gauge, GaugeVec, Histogram, HistogramOpts, Opts, Registry,
    TextEncoder,
};

/// Metrics for the recorder pipeline, namespaced `okx_recorder_*` and
/// mirroring `binance-recorder`'s set.
///
/// Covers the queue and ClickHouse-insert surface emitted by the stream worker
/// and writer loop, plus the readiness/liveness surface emitted by the health
/// probe and stream worker: a ClickHouse-up gauge, a ready-state gauge, and
/// per-instrument ToB and trades last-seen timestamps. The funding lane adds
/// its own poll, insert, and last-event metrics. Only the ToB gauge's
/// freshness gates `/ready`; every other lane's metrics feed dashboards and
/// alerts but never gate `/ready`. `/metrics` exposition is served from
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
    pub tob_last_seen_unix_seconds: GaugeVec,
    pub trades_last_seen_unix_seconds: GaugeVec,
    pub funding_poll_attempts: CounterVec,
    pub funding_insert_attempts: CounterVec,
    pub funding_insert_rows: Counter,
    pub funding_insert_latency_seconds: Histogram,
    pub funding_last_event_unix_seconds: GaugeVec,
    pub stream_reconnects: Counter,
    pub clickhouse_up: Gauge,
    pub ready_state: Gauge,
}

impl RecorderMetrics {
    pub fn new() -> Result<Self> {
        let registry = Registry::new();

        let queue_depth = Gauge::with_opts(Opts::new(
            "okx_recorder_queue_depth",
            "Current in-memory queue depth",
        ))?;
        let queue_fill_ratio = Gauge::with_opts(Opts::new(
            "okx_recorder_queue_fill_ratio",
            "Current in-memory queue fill ratio",
        ))?;
        let queue_drops = CounterVec::new(
            Opts::new(
                "okx_recorder_queue_drops_total",
                "Total dropped rows due to queue saturation",
            ),
            &["inst_id"],
        )?;
        let insert_attempts = CounterVec::new(
            Opts::new(
                "okx_recorder_insert_attempts_total",
                "Total ClickHouse insert attempts",
            ),
            &["status"],
        )?;
        let insert_rows = Counter::with_opts(Opts::new(
            "okx_recorder_insert_rows_total",
            "Total rows inserted into ClickHouse",
        ))?;
        let insert_latency_seconds = Histogram::with_opts(
            HistogramOpts::new(
                "okx_recorder_insert_latency_seconds",
                "ClickHouse insert latency in seconds",
            )
            .buckets(vec![0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0]),
        )?;
        let tob_last_seen_unix_seconds = GaugeVec::new(
            Opts::new(
                "okx_recorder_tob_last_seen_unix_seconds",
                "Unix timestamp of the last received top-of-book update per instrument",
            ),
            &["inst_id"],
        )?;
        let trades_last_seen_unix_seconds = GaugeVec::new(
            Opts::new(
                "okx_recorder_trades_last_seen_unix_seconds",
                "Unix timestamp of the last received trade print per instrument (staleness signal only; never gates /ready)",
            ),
            &["inst_id"],
        )?;
        let funding_poll_attempts = CounterVec::new(
            Opts::new(
                "okx_recorder_funding_poll_attempts_total",
                "Total funding-rate-history poll attempts by instrument and outcome",
            ),
            &["inst_id", "status"],
        )?;
        let funding_insert_attempts = CounterVec::new(
            Opts::new(
                "okx_recorder_funding_insert_attempts_total",
                "Total ClickHouse insert attempts for funding batches",
            ),
            &["status"],
        )?;
        let funding_insert_rows = Counter::with_opts(Opts::new(
            "okx_recorder_funding_insert_rows_total",
            "Total funding rows inserted into ClickHouse",
        ))?;
        let funding_insert_latency_seconds = Histogram::with_opts(
            HistogramOpts::new(
                "okx_recorder_funding_insert_latency_seconds",
                "ClickHouse funding insert latency in seconds",
            )
            .buckets(vec![0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0]),
        )?;
        let funding_last_event_unix_seconds = GaugeVec::new(
            Opts::new(
                "okx_recorder_funding_last_event_unix_seconds",
                "Exchange settlement timestamp (unix seconds) of the most recent settled \
                 funding event observed per instrument. Funding settles on an hours-scale \
                 cadence, so an age of several hours is normal — alert on it, never gate \
                 readiness with it.",
            ),
            &["inst_id"],
        )?;
        let stream_reconnects = Counter::with_opts(Opts::new(
            "okx_recorder_stream_reconnects_total",
            "Total websocket reconnect attempts after a connection failure",
        ))?;
        let clickhouse_up = Gauge::with_opts(Opts::new(
            "okx_recorder_clickhouse_up",
            "Whether ClickHouse is currently reachable (1/0)",
        ))?;
        let ready_state = Gauge::with_opts(Opts::new(
            "okx_recorder_ready",
            "Readiness status (1=ready, 0=not ready)",
        ))?;

        registry.register(Box::new(queue_depth.clone()))?;
        registry.register(Box::new(queue_fill_ratio.clone()))?;
        registry.register(Box::new(queue_drops.clone()))?;
        registry.register(Box::new(insert_attempts.clone()))?;
        registry.register(Box::new(insert_rows.clone()))?;
        registry.register(Box::new(insert_latency_seconds.clone()))?;
        registry.register(Box::new(tob_last_seen_unix_seconds.clone()))?;
        registry.register(Box::new(trades_last_seen_unix_seconds.clone()))?;
        registry.register(Box::new(funding_poll_attempts.clone()))?;
        registry.register(Box::new(funding_insert_attempts.clone()))?;
        registry.register(Box::new(funding_insert_rows.clone()))?;
        registry.register(Box::new(funding_insert_latency_seconds.clone()))?;
        registry.register(Box::new(funding_last_event_unix_seconds.clone()))?;
        registry.register(Box::new(stream_reconnects.clone()))?;
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
            tob_last_seen_unix_seconds,
            trades_last_seen_unix_seconds,
            funding_poll_attempts,
            funding_insert_attempts,
            funding_insert_rows,
            funding_insert_latency_seconds,
            funding_last_event_unix_seconds,
            stream_reconnects,
            clickhouse_up,
            ready_state,
        })
    }

    /// Pre-initialize the per-instrument ToB last-seen gauge for every
    /// configured instrument, stamped with the current time (process start).
    ///
    /// Without this, the `{inst_id}` series only exists after the first update
    /// arrives, so an instrument that never streams has no series and
    /// age-based staleness alerts can never fire for it. Seeding at startup
    /// makes the age grow from boot when nothing ever arrives.
    pub fn init_instruments(&self, inst_ids: &[String]) {
        let started_at = unix_seconds_now();
        for inst_id in inst_ids {
            self.tob_last_seen_unix_seconds
                .with_label_values(&[inst_id])
                .set(started_at);
        }
    }

    /// Record a dropped row for `inst_id` when the bounded queue is full.
    pub fn record_queue_drop(&self, inst_id: &str) {
        self.queue_drops.with_label_values(&[inst_id]).inc();
    }

    /// Stamp the per-instrument ToB last-seen gauge when a fresh update is
    /// received.
    pub fn record_tob_seen(&self, inst_id: &str) {
        self.tob_last_seen_unix_seconds
            .with_label_values(&[inst_id])
            .set(unix_seconds_now());
    }

    /// Stamp the per-instrument trades last-seen gauge when a trade print is
    /// received. Staleness derived from this gauge is observability-only and
    /// never gates `/ready`.
    pub fn record_trade_seen(&self, inst_id: &str) {
        self.trades_last_seen_unix_seconds
            .with_label_values(&[inst_id])
            .set(unix_seconds_now());
    }

    /// Advance the per-instrument settled-funding last-event gauge to
    /// `funding_time` (exchange settlement time). Monotone max: polls return a
    /// trailing history window, so older events in the same batch must not
    /// rewind the gauge.
    pub fn record_funding_event(&self, inst_id: &str, funding_time: chrono::DateTime<chrono::Utc>) {
        let gauge = self
            .funding_last_event_unix_seconds
            .with_label_values(&[inst_id]);
        let new_value = funding_time.timestamp_millis() as f64 / 1000.0;
        if new_value > gauge.get() {
            gauge.set(new_value);
        }
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
