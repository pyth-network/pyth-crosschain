use std::{sync::Arc, time::Duration};

use tokio::{
    sync::mpsc,
    task::JoinHandle,
    time::{Instant, MissedTickBehavior},
};
use tokio_util::sync::CancellationToken;

use crate::{
    clickhouse::ClickHouseClient, health::HealthState, metrics::RecorderMetrics,
    models::BookTicker, stream_client::run_stream_worker,
};

#[derive(Clone, Debug)]
pub struct WriterRuntimeConfig {
    pub batch_max_rows: usize,
    pub batch_flush_seconds: f64,
    pub queue_max_rows: usize,
}

/// Orchestrates the recorder pipeline: a single combined websocket worker feeds
/// an mpsc channel, and a writer loop batch-inserts into ClickHouse. Ported from
/// `ondo-recorder`'s `RecorderRuntime`, with the poller replaced by the SDK
/// stream worker. The writer buffers every update — `bookTicker` is a
/// forward-only push stream with unique per-symbol `update_id`s, so there are no
/// stream-level duplicates to collapse; `ReplacingMergeTree` absorbs any
/// insert-retry duplicates.
pub struct RecorderRuntime {
    markets: Vec<String>,
    reconnect_delay_ms: u64,
    writer: ClickHouseClient,
    writer_config: WriterRuntimeConfig,
    metrics: Arc<RecorderMetrics>,
    health: HealthState,
    insert_async: bool,
    stop_token: CancellationToken,
    handles: Vec<JoinHandle<()>>,
}

impl RecorderRuntime {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        markets: Vec<String>,
        reconnect_max_backoff_seconds: u64,
        writer: ClickHouseClient,
        writer_config: WriterRuntimeConfig,
        metrics: Arc<RecorderMetrics>,
        health: HealthState,
        insert_async: bool,
    ) -> Self {
        Self {
            markets,
            reconnect_delay_ms: reconnect_max_backoff_seconds.saturating_mul(1_000),
            writer,
            writer_config,
            metrics,
            health,
            insert_async,
            stop_token: CancellationToken::new(),
            handles: Vec::new(),
        }
    }

    pub fn start(&mut self) {
        let (tx, rx) = mpsc::channel::<BookTicker>(self.writer_config.queue_max_rows);
        self.spawn_writer_loop(rx);

        let markets = self.markets.clone();
        let reconnect_delay_ms = self.reconnect_delay_ms;
        let metrics = self.metrics.clone();
        let health = self.health.clone();
        let stop_token = self.stop_token.clone();
        let handle = tokio::spawn(async move {
            if let Err(err) =
                run_stream_worker(markets, reconnect_delay_ms, tx, metrics, health, stop_token)
                    .await
            {
                tracing::error!(error = ?err, "stream worker failed");
            }
        });
        self.handles.push(handle);

        self.spawn_health_probe_loop();
    }

    pub async fn stop(&self) {
        self.stop_token.cancel();
    }

    pub async fn wait_forever(self) {
        for handle in self.handles {
            let _ = handle.await;
        }
    }

    fn spawn_writer_loop(&mut self, mut receiver: mpsc::Receiver<BookTicker>) {
        let writer = self.writer.clone();
        let metrics = self.metrics.clone();
        let batch_max_rows = self.writer_config.batch_max_rows;
        let batch_flush_seconds = self.writer_config.batch_flush_seconds;
        let queue_max_rows = self.writer_config.queue_max_rows;
        let stop_token = self.stop_token.clone();
        let insert_async = self.insert_async;

        let handle = tokio::spawn(async move {
            // Buffer every update: `bookTicker` is a forward-only push stream
            // with unique per-symbol `update_id`s, so there are no stream-level
            // duplicates to collapse. Insert-retry duplicates (a flush that
            // times out client-side but commits server-side) are absorbed by
            // ClickHouse's `ReplacingMergeTree`.
            let mut buffer: Vec<BookTicker> = Vec::with_capacity(batch_max_rows);
            let mut last_flush = Instant::now();

            loop {
                if stop_token.is_cancelled() && receiver.is_empty() {
                    break;
                }
                let elapsed = last_flush.elapsed().as_secs_f64();
                let wait_seconds = (batch_flush_seconds - elapsed).max(0.1);
                match tokio::time::timeout(Duration::from_secs_f64(wait_seconds), receiver.recv())
                    .await
                {
                    Ok(Some(ticker)) => {
                        buffer.push(ticker);
                        let size = receiver.len();
                        metrics.queue_depth.set(size as f64);
                        metrics
                            .queue_fill_ratio
                            .set(size as f64 / queue_max_rows.max(1) as f64);
                    }
                    Ok(None) => break,
                    Err(_) => {}
                }

                let should_flush = buffer.len() >= batch_max_rows
                    || (!buffer.is_empty()
                        && last_flush.elapsed().as_secs_f64() >= batch_flush_seconds);
                if should_flush {
                    let batch = drain_batch(&mut buffer);
                    flush_with_retry(&writer, &metrics, batch, stop_token.clone(), insert_async)
                        .await;
                    last_flush = Instant::now();
                }
            }

            // Bounded shutdown drain: flush whatever is still buffered instead of
            // dropping the last rows.
            if !buffer.is_empty() {
                let batch = drain_batch(&mut buffer);
                flush_with_retry(&writer, &metrics, batch, stop_token, insert_async).await;
            }
        });
        self.handles.push(handle);
    }

    /// Periodically ping ClickHouse and refresh the readiness gauges. Per-symbol
    /// freshness is driven from the stream callback; this loop owns only the
    /// ClickHouse-up and overall-ready signals (the SDK owns reconnection, so
    /// there is no separate connection-liveness probe).
    fn spawn_health_probe_loop(&mut self) {
        let writer = self.writer.clone();
        let metrics = self.metrics.clone();
        let health = self.health.clone();
        let stop_token = self.stop_token.clone();

        let handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5));
            interval.set_missed_tick_behavior(MissedTickBehavior::Delay);
            while !stop_token.is_cancelled() {
                interval.tick().await;
                let healthy = writer.ping().await;
                health.set_clickhouse_ok(healthy);
                metrics.clickhouse_up.set(if healthy { 1.0 } else { 0.0 });
                metrics
                    .ready_state
                    .set(if health.is_ready() { 1.0 } else { 0.0 });
            }
        });
        self.handles.push(handle);
    }
}

fn drain_batch(buffer: &mut Vec<BookTicker>) -> Vec<BookTicker> {
    std::mem::take(buffer)
}

async fn flush_with_retry(
    writer: &ClickHouseClient,
    metrics: &RecorderMetrics,
    batch: Vec<BookTicker>,
    stop_token: CancellationToken,
    insert_async: bool,
) {
    if batch.is_empty() {
        return;
    }
    loop {
        if stop_token.is_cancelled() {
            // On shutdown, make a single best-effort attempt rather than
            // retrying forever against an unreachable ClickHouse.
            match writer.insert_batch(&batch, insert_async).await {
                Ok((rows, latency)) => {
                    record_insert_success(metrics, rows, latency);
                }
                Err(err) => {
                    metrics.insert_attempts.with_label_values(&["error"]).inc();
                    tracing::error!(
                        rows = batch.len(),
                        error = ?err,
                        "failed to insert book ticker batch during shutdown drain"
                    );
                }
            }
            return;
        }
        match writer.insert_batch(&batch, insert_async).await {
            Ok((rows, latency)) => {
                record_insert_success(metrics, rows, latency);
                return;
            }
            Err(err) => {
                metrics.insert_attempts.with_label_values(&["error"]).inc();
                tracing::error!(
                    rows = batch.len(),
                    error = ?err,
                    "failed to insert book ticker batch"
                );
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
    }
}

fn record_insert_success(metrics: &RecorderMetrics, rows: usize, latency: f64) {
    metrics
        .insert_attempts
        .with_label_values(&["success"])
        .inc();
    metrics.insert_rows.inc_by(rows as f64);
    metrics.insert_latency_seconds.observe(latency);
    tracing::debug!("inserted {} book ticker rows into ClickHouse", rows);
}
