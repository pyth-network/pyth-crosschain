use std::{collections::HashMap, sync::Arc, time::Duration};

use tokio::{
    sync::mpsc,
    task::JoinHandle,
    time::{Instant, MissedTickBehavior},
};
use tokio_util::sync::CancellationToken;

use crate::{
    clickhouse::ClickHouseClient,
    funding_client::poll_funding_once,
    health::HealthState,
    metrics::RecorderMetrics,
    models::{BookTicker, FundingRate, LaneRow},
    stream_client::run_stream_worker,
};

/// Overall per-request deadline for funding-history polls. The poll loop is
/// sequential, so a request that never completes would otherwise stall the
/// funding lane forever without incrementing any error counter.
const FUNDING_REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// TCP connect deadline for funding-history polls, stricter than the overall
/// request timeout so an unreachable endpoint fails fast.
const FUNDING_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Debug)]
pub struct WriterRuntimeConfig {
    pub batch_max_rows: usize,
    pub batch_flush_seconds: f64,
    pub queue_max_rows: usize,
}

#[derive(Clone, Debug)]
pub struct FundingRuntimeConfig {
    pub history_url: String,
    pub poll_seconds: u64,
    pub history_limit: u32,
}

/// Orchestrates the recorder pipeline: a single multiplexed websocket worker
/// feeds an mpsc channel of [`LaneRow`]s, and a writer loop batch-inserts each
/// lane into its ClickHouse table. Ported from `binance-recorder`'s
/// `RecorderRuntime`. The writer buffers every update with no in-memory dedupe
/// — row identity is owned by ClickHouse (`ReplacingMergeTree(ingested_at)`
/// over the table's ORDER BY keys). Because `received_at` is part of the ORDER
/// BY, this collapses byte-identical insert retries only; a genuine exchange
/// re-send arrives with a new `received_at` and is persisted as a distinct row
/// by design. Follow-up websocket lanes (trades) add their own [`LaneRow`]
/// variants and per-lane buffers here. The funding lane is REST instead: it
/// polls on a minutes-scale cadence and inserts its small batches directly,
/// bypassing the queue.
pub struct RecorderRuntime {
    ws_url: String,
    instruments: Vec<String>,
    reconnect_max_backoff_seconds: u64,
    writer: ClickHouseClient,
    writer_config: WriterRuntimeConfig,
    funding_config: FundingRuntimeConfig,
    metrics: Arc<RecorderMetrics>,
    health: HealthState,
    insert_async: bool,
    stop_token: CancellationToken,
    handles: Vec<JoinHandle<()>>,
}

impl RecorderRuntime {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        ws_url: String,
        instruments: Vec<String>,
        reconnect_max_backoff_seconds: u64,
        writer: ClickHouseClient,
        writer_config: WriterRuntimeConfig,
        funding_config: FundingRuntimeConfig,
        metrics: Arc<RecorderMetrics>,
        health: HealthState,
        insert_async: bool,
    ) -> Self {
        Self {
            ws_url,
            instruments,
            reconnect_max_backoff_seconds,
            writer,
            writer_config,
            funding_config,
            metrics,
            health,
            insert_async,
            stop_token: CancellationToken::new(),
            handles: Vec::new(),
        }
    }

    pub fn start(&mut self) {
        // Seed per-instrument metric series before any data arrives so
        // age-based staleness alerts cover instruments that never stream.
        self.metrics.init_instruments(&self.instruments);

        let (tx, rx) = mpsc::channel::<LaneRow>(self.writer_config.queue_max_rows);
        self.spawn_writer_loop(rx);

        let ws_url = self.ws_url.clone();
        let instruments = self.instruments.clone();
        let reconnect_max_backoff_seconds = self.reconnect_max_backoff_seconds;
        let metrics = self.metrics.clone();
        let health = self.health.clone();
        let stop_token = self.stop_token.clone();
        let handle = tokio::spawn(async move {
            run_stream_worker(
                ws_url,
                instruments,
                reconnect_max_backoff_seconds,
                tx,
                metrics,
                health,
                stop_token,
            )
            .await;
        });
        self.handles.push(handle);

        self.spawn_funding_loop();
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

    fn spawn_writer_loop(&mut self, mut receiver: mpsc::Receiver<LaneRow>) {
        let writer = self.writer.clone();
        let metrics = self.metrics.clone();
        let batch_max_rows = self.writer_config.batch_max_rows;
        let batch_flush_seconds = self.writer_config.batch_flush_seconds;
        let queue_max_rows = self.writer_config.queue_max_rows;
        let stop_token = self.stop_token.clone();
        let insert_async = self.insert_async;

        let handle = tokio::spawn(async move {
            // Buffer every update: no in-memory dedupe, by design. ClickHouse's
            // `ReplacingMergeTree(ingested_at)` owns row identity via the
            // table's ORDER BY keys, which include `received_at` — so only
            // insert retries (a flush that times out client-side but commits
            // server-side) collapse at merge time. A genuine exchange re-send
            // carries a new `received_at` and is persisted as a distinct row.
            let mut book_buffer: Vec<BookTicker> = Vec::with_capacity(batch_max_rows);
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
                    Ok(Some(row)) => {
                        match row {
                            LaneRow::BookTicker(ticker) => book_buffer.push(ticker),
                        }
                        let size = receiver.len();
                        metrics.queue_depth.set(size as f64);
                        metrics
                            .queue_fill_ratio
                            .set(size as f64 / queue_max_rows.max(1) as f64);
                    }
                    Ok(None) => break,
                    Err(_) => {}
                }

                let should_flush = book_buffer.len() >= batch_max_rows
                    || (!book_buffer.is_empty()
                        && last_flush.elapsed().as_secs_f64() >= batch_flush_seconds);
                if should_flush {
                    let batch = drain_batch(&mut book_buffer);
                    flush_with_retry(&writer, &metrics, batch, stop_token.clone(), insert_async)
                        .await;
                    last_flush = Instant::now();
                }
            }

            // Bounded shutdown drain: flush whatever is still buffered instead of
            // dropping the last rows.
            if !book_buffer.is_empty() {
                let batch = drain_batch(&mut book_buffer);
                flush_with_retry(&writer, &metrics, batch, stop_token, insert_async).await;
            }
        });
        self.handles.push(handle);
    }

    /// Poll the settled funding-rate history for every configured instrument
    /// on a minutes-scale cadence and insert each poll's batch directly.
    /// Funding settles hourly at most, so each poll yields a handful of rows —
    /// no queueing or batching needed. Every poll re-fetches a trailing history
    /// window; the resulting duplicates are collapsed by
    /// `ReplacingMergeTree(ingested_at)` over `(inst_id, funding_time)`, so
    /// re-polling is idempotent by design. This lane feeds the funding
    /// last-event metric but never touches `HealthState` — funding staleness
    /// must not gate `/ready`.
    fn spawn_funding_loop(&mut self) {
        let history_url = self.funding_config.history_url.clone();
        let instruments = self.instruments.clone();
        let poll_seconds = self.funding_config.poll_seconds;
        let history_limit = self.funding_config.history_limit;
        let max_backoff = self.reconnect_max_backoff_seconds;
        let writer = self.writer.clone();
        let metrics = self.metrics.clone();
        let insert_async = self.insert_async;
        let stop_token = self.stop_token.clone();

        // Explicit timeouts so a hung endpoint surfaces as a normal
        // per-instrument poll error (error counter + backoff) instead of
        // stalling the sequential poll loop indefinitely.
        let http = match reqwest::Client::builder()
            .timeout(FUNDING_REQUEST_TIMEOUT)
            .connect_timeout(FUNDING_CONNECT_TIMEOUT)
            .build()
        {
            Ok(http) => http,
            Err(err) => {
                // Builder failure means the TLS backend could not initialize;
                // leave the funding lane down and let the funding staleness
                // alert surface it rather than polling without timeouts.
                tracing::error!(
                    error = ?err,
                    "failed to build funding HTTP client; funding lane disabled"
                );
                return;
            }
        };

        let handle = tokio::spawn(async move {
            let mut backoff: HashMap<String, u64> = HashMap::new();
            let mut ticker = tokio::time::interval(Duration::from_secs(poll_seconds.max(1)));
            ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);

            while stop_token
                .run_until_cancelled(async {
                    ticker.tick().await;

                    let batch = poll_funding_once(
                        &http,
                        &history_url,
                        &instruments,
                        history_limit,
                        max_backoff,
                        &metrics,
                        &mut backoff,
                        &stop_token,
                    )
                    .await;

                    for row in &batch {
                        metrics.record_funding_event(&row.inst_id, row.funding_time);
                    }

                    if !batch.is_empty() {
                        flush_funding_with_retry(
                            &writer,
                            &metrics,
                            batch,
                            stop_token.clone(),
                            insert_async,
                        )
                        .await;
                    }
                })
                .await
                .is_some()
            {}
        });
        self.handles.push(handle);
    }

    /// Periodically ping ClickHouse and refresh the readiness gauges.
    /// Per-instrument ToB freshness is driven from the stream worker; this loop
    /// owns only the ClickHouse-up and overall-ready signals.
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
            match writer.insert_book_ticker_batch(&batch, insert_async).await {
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
        match writer.insert_book_ticker_batch(&batch, insert_async).await {
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

async fn flush_funding_with_retry(
    writer: &ClickHouseClient,
    metrics: &RecorderMetrics,
    batch: Vec<FundingRate>,
    stop_token: CancellationToken,
    insert_async: bool,
) {
    loop {
        match writer.insert_funding_batch(&batch, insert_async).await {
            Ok((rows, latency)) => {
                metrics
                    .funding_insert_attempts
                    .with_label_values(&["success"])
                    .inc();
                metrics.funding_insert_rows.inc_by(rows as f64);
                metrics.funding_insert_latency_seconds.observe(latency);
                tracing::debug!("inserted {} funding rows into ClickHouse", rows);
                return;
            }
            Err(err) => {
                metrics
                    .funding_insert_attempts
                    .with_label_values(&["error"])
                    .inc();
                tracing::error!(
                    rows = batch.len(),
                    error = ?err,
                    "failed to insert funding batch"
                );
                // On shutdown, drop the batch instead of retrying against an
                // unreachable ClickHouse: the next poll after restart
                // re-fetches the same window, so a dropped batch self-heals.
                if stop_token.is_cancelled() {
                    return;
                }
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
