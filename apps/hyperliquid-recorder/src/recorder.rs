use std::{collections::HashMap, sync::Arc, time::Duration};

use tokio::{
    sync::mpsc,
    task::JoinHandle,
    time::{interval, Instant, MissedTickBehavior},
};
use tokio_util::sync::CancellationToken;

/// On graceful shutdown, give the writer this many attempts (with exponential
/// backoff) to flush whatever it has buffered before giving up. The point is
/// "don't silently drop the last batch", not "retry forever".
const SHUTDOWN_DRAIN_MAX_ATTEMPTS: u32 = 3;
const SHUTDOWN_DRAIN_INITIAL_BACKOFF: Duration = Duration::from_millis(500);

/// Initial sleep between failed CH insert attempts on the live retry path.
/// Doubled each attempt up to `reconnect_max_backoff_seconds`. Slows the retry
/// drumbeat during outages so we don't hammer a struggling CH at 1Hz.
const INSERT_RETRY_INITIAL_DELAY: Duration = Duration::from_secs(1);

use crate::{
    clickhouse::ClickHouseClient,
    funding_client::poll_funding_once,
    health::HealthState,
    metrics::RecorderMetrics,
    models::{FundingRateRecord, L2Snapshot, MarketSubscription, TradeRecord},
    stream_client::{run_stream_worker, run_trades_stream_worker},
};

#[derive(Clone, Debug)]
pub struct WriterRuntimeConfig {
    pub batch_max_rows: usize,
    pub batch_flush_seconds: f64,
    pub queue_max_rows: usize,
}

#[derive(Clone, Debug)]
pub struct FundingRuntimeConfig {
    pub info_api_url: String,
    pub poll_seconds: u64,
    pub lookback_seconds: u64,
}

pub struct RecorderRuntime {
    endpoint: String,
    auth_token: String,
    markets: Vec<MarketSubscription>,
    writer: ClickHouseClient,
    writer_config: WriterRuntimeConfig,
    funding_config: FundingRuntimeConfig,
    metrics: Arc<RecorderMetrics>,
    health: HealthState,
    reconnect_max_backoff_seconds: u64,
    insert_async: bool,
    stop_token: CancellationToken,
    handles: Vec<JoinHandle<()>>,
}

impl RecorderRuntime {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        endpoint: String,
        auth_token: String,
        markets: Vec<MarketSubscription>,
        writer: ClickHouseClient,
        writer_config: WriterRuntimeConfig,
        funding_config: FundingRuntimeConfig,
        metrics: Arc<RecorderMetrics>,
        health: HealthState,
        reconnect_max_backoff_seconds: u64,
        insert_async: bool,
    ) -> Self {
        Self {
            endpoint,
            auth_token,
            markets,
            writer,
            writer_config,
            funding_config,
            metrics,
            health,
            reconnect_max_backoff_seconds,
            insert_async,
            stop_token: CancellationToken::new(),
            handles: Vec::new(),
        }
    }

    pub fn stop_token(&self) -> CancellationToken {
        self.stop_token.clone()
    }

    pub fn start(&mut self) {
        let (l2_tx, l2_rx) = mpsc::channel::<L2Snapshot>(self.writer_config.queue_max_rows);
        let (trade_tx, trade_rx) = mpsc::channel::<TradeRecord>(self.writer_config.queue_max_rows);
        self.spawn_l2_writer_loop(l2_rx);
        self.spawn_trade_writer_loop(trade_rx);

        for market in self.markets.clone() {
            let handle = tokio::spawn(run_stream_worker(
                self.endpoint.clone(),
                self.auth_token.clone(),
                market,
                self.reconnect_max_backoff_seconds,
                l2_tx.clone(),
                self.metrics.clone(),
                self.stop_token.clone(),
            ));
            self.handles.push(handle);
        }

        let trade_handle = tokio::spawn(run_trades_stream_worker(
            self.endpoint.clone(),
            self.auth_token.clone(),
            self.markets.clone(),
            self.reconnect_max_backoff_seconds,
            trade_tx,
            self.metrics.clone(),
            self.stop_token.clone(),
        ));
        self.handles.push(trade_handle);

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

    fn spawn_l2_writer_loop(&mut self, mut receiver: mpsc::Receiver<L2Snapshot>) {
        let writer = self.writer.clone();
        let metrics = self.metrics.clone();
        let health = self.health.clone();
        let batch_max_rows = self.writer_config.batch_max_rows;
        let batch_flush_seconds = self.writer_config.batch_flush_seconds;
        let queue_max_rows = self.writer_config.queue_max_rows;
        let stop_token = self.stop_token.clone();
        let insert_async = self.insert_async;
        let max_backoff_seconds = self.reconnect_max_backoff_seconds;

        let handle = tokio::spawn(async move {
            let mut dedupe: HashMap<(String, u64, u32, u32, u64), L2Snapshot> = HashMap::new();
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
                    Ok(Some(snapshot)) => {
                        health.set_market_seen(&snapshot.coin);
                        dedupe.insert(snapshot.dedupe_key(), snapshot);
                        let size = receiver.len();
                        metrics.queue_depth.set(size as f64);
                        metrics
                            .queue_fill_ratio
                            .set(size as f64 / queue_max_rows.max(1) as f64);
                    }
                    Ok(None) => break,
                    Err(_) => {}
                }

                let should_flush = dedupe.len() >= batch_max_rows
                    || (!dedupe.is_empty()
                        && last_flush.elapsed().as_secs_f64() >= batch_flush_seconds);
                if should_flush {
                    flush_with_retry(
                        &writer,
                        &metrics,
                        dedupe.values().cloned().collect::<Vec<_>>(),
                        stop_token.clone(),
                        insert_async,
                        max_backoff_seconds,
                    )
                    .await;
                    dedupe.clear();
                    last_flush = Instant::now();
                }
            }

            if !dedupe.is_empty() {
                drain_l2_on_shutdown(
                    &writer,
                    &metrics,
                    dedupe.values().cloned().collect::<Vec<_>>(),
                    insert_async,
                )
                .await;
            }
        });
        self.handles.push(handle);
    }

    #[allow(clippy::type_complexity)]
    fn spawn_trade_writer_loop(&mut self, mut receiver: mpsc::Receiver<TradeRecord>) {
        let writer = self.writer.clone();
        let metrics = self.metrics.clone();
        let health = self.health.clone();
        let batch_max_rows = self.writer_config.batch_max_rows;
        let batch_flush_seconds = self.writer_config.batch_flush_seconds;
        let queue_max_rows = self.writer_config.queue_max_rows;
        let stop_token = self.stop_token.clone();
        let insert_async = self.insert_async;
        let max_backoff_seconds = self.reconnect_max_backoff_seconds;

        let handle = tokio::spawn(async move {
            let mut dedupe: HashMap<(String, u64, String, String, u64, u64, String), TradeRecord> =
                HashMap::new();
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
                    Ok(Some(trade)) => {
                        health.set_market_seen(&trade.coin);
                        dedupe.insert(trade.dedupe_key(), trade);
                        let size = receiver.len();
                        metrics.trades_queue_depth.set(size as f64);
                        metrics
                            .trades_queue_fill_ratio
                            .set(size as f64 / queue_max_rows.max(1) as f64);
                    }
                    Ok(None) => break,
                    Err(_) => {}
                }

                let should_flush = dedupe.len() >= batch_max_rows
                    || (!dedupe.is_empty()
                        && last_flush.elapsed().as_secs_f64() >= batch_flush_seconds);
                if should_flush {
                    flush_trades_with_retry(
                        &writer,
                        &metrics,
                        dedupe.values().cloned().collect::<Vec<_>>(),
                        stop_token.clone(),
                        insert_async,
                        max_backoff_seconds,
                    )
                    .await;
                    dedupe.clear();
                    last_flush = Instant::now();
                }
            }

            if !dedupe.is_empty() {
                drain_trades_on_shutdown(
                    &writer,
                    &metrics,
                    dedupe.values().cloned().collect::<Vec<_>>(),
                    insert_async,
                )
                .await;
            }
        });
        self.handles.push(handle);
    }

    fn spawn_funding_loop(&mut self) {
        let info_api_url = self.funding_config.info_api_url.clone();
        let markets = self.markets.clone();
        let poll_seconds = self.funding_config.poll_seconds;
        let lookback_seconds = self.funding_config.lookback_seconds;
        let max_backoff = self.reconnect_max_backoff_seconds;
        let writer = self.writer.clone();
        let metrics = self.metrics.clone();
        let health = self.health.clone();
        let insert_async = self.insert_async;
        let stop_token = self.stop_token.clone();

        let handle = tokio::spawn(async move {
            let http = reqwest::Client::new();
            let mut backoff: HashMap<String, u64> = HashMap::new();
            let mut ticker = interval(Duration::from_secs(poll_seconds.max(1)));
            ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);

            while stop_token
                .run_until_cancelled(async {
                    ticker.tick().await;

                    let batch = poll_funding_once(
                        &http,
                        &info_api_url,
                        &markets,
                        lookback_seconds,
                        max_backoff,
                        &metrics,
                        &mut backoff,
                        &stop_token,
                    )
                    .await;

                    for record in &batch {
                        metrics.record_funding(record);
                        health.set_funding_event_seen(&record.coin, record.funding_time_ms);
                    }

                    if !batch.is_empty() {
                        flush_funding_with_retry(
                            &writer,
                            &metrics,
                            batch,
                            stop_token.clone(),
                            insert_async,
                            max_backoff,
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

/// Drain the in-memory L2 buffer on shutdown. Unlike `flush_with_retry`, this
/// does **not** consult the cancellation token (which is always set during
/// shutdown) — it would otherwise return immediately and silently drop the
/// last batch. Instead it makes a bounded number of attempts with exponential
/// backoff so a flaky CH at shutdown doesn't permanently stall the process.
async fn drain_l2_on_shutdown(
    writer: &ClickHouseClient,
    metrics: &RecorderMetrics,
    batch: Vec<L2Snapshot>,
    insert_async: bool,
) {
    if batch.is_empty() {
        return;
    }
    let mut delay = SHUTDOWN_DRAIN_INITIAL_BACKOFF;
    for attempt in 1..=SHUTDOWN_DRAIN_MAX_ATTEMPTS {
        match writer.insert_batch(&batch, insert_async).await {
            Ok((rows, latency)) => {
                metrics
                    .insert_attempts
                    .with_label_values(&["success"])
                    .inc();
                metrics.insert_rows.inc_by(rows as f64);
                metrics.insert_latency_seconds.observe(latency);
                tracing::info!(
                    rows,
                    attempt,
                    "drained {} L2 rows into ClickHouse on shutdown",
                    rows
                );
                return;
            }
            Err(err) => {
                metrics.insert_attempts.with_label_values(&["error"]).inc();
                tracing::error!(
                    rows = batch.len(),
                    attempt,
                    error = ?err,
                    "shutdown drain attempt for L2 batch failed"
                );
                if attempt < SHUTDOWN_DRAIN_MAX_ATTEMPTS {
                    tokio::time::sleep(delay).await;
                    delay = delay.saturating_mul(2);
                }
            }
        }
    }
    tracing::error!(
        rows = batch.len(),
        attempts = SHUTDOWN_DRAIN_MAX_ATTEMPTS,
        "giving up on L2 shutdown drain; rows lost"
    );
}

/// See `drain_l2_on_shutdown`. Same shape, different table.
async fn drain_trades_on_shutdown(
    writer: &ClickHouseClient,
    metrics: &RecorderMetrics,
    batch: Vec<TradeRecord>,
    insert_async: bool,
) {
    if batch.is_empty() {
        return;
    }
    let mut delay = SHUTDOWN_DRAIN_INITIAL_BACKOFF;
    for attempt in 1..=SHUTDOWN_DRAIN_MAX_ATTEMPTS {
        match writer.insert_trades_batch(&batch, insert_async).await {
            Ok((rows, latency)) => {
                metrics
                    .insert_trades_attempts
                    .with_label_values(&["success"])
                    .inc();
                metrics.insert_trades_rows.inc_by(rows as f64);
                metrics.insert_trades_latency_seconds.observe(latency);
                tracing::info!(
                    rows,
                    attempt,
                    "drained {} trade rows into ClickHouse on shutdown",
                    rows
                );
                return;
            }
            Err(err) => {
                metrics
                    .insert_trades_attempts
                    .with_label_values(&["error"])
                    .inc();
                tracing::error!(
                    rows = batch.len(),
                    attempt,
                    error = ?err,
                    "shutdown drain attempt for trade batch failed"
                );
                if attempt < SHUTDOWN_DRAIN_MAX_ATTEMPTS {
                    tokio::time::sleep(delay).await;
                    delay = delay.saturating_mul(2);
                }
            }
        }
    }
    tracing::error!(
        rows = batch.len(),
        attempts = SHUTDOWN_DRAIN_MAX_ATTEMPTS,
        "giving up on trade shutdown drain; rows lost"
    );
}

async fn flush_with_retry(
    writer: &ClickHouseClient,
    metrics: &RecorderMetrics,
    batch: Vec<L2Snapshot>,
    stop_token: CancellationToken,
    insert_async: bool,
    max_backoff_seconds: u64,
) {
    if batch.is_empty() {
        return;
    }
    let max_delay = Duration::from_secs(max_backoff_seconds.max(1));
    let mut delay = INSERT_RETRY_INITIAL_DELAY;
    let mut attempt: u32 = 0;
    loop {
        if stop_token.is_cancelled() {
            return;
        }
        match writer.insert_batch(&batch, insert_async).await {
            Ok((rows, latency)) => {
                metrics
                    .insert_attempts
                    .with_label_values(&["success"])
                    .inc();
                metrics.insert_rows.inc_by(rows as f64);
                metrics.insert_latency_seconds.observe(latency);
                if attempt > 0 {
                    tracing::info!(rows, recovered_after_attempts = attempt, "L2 insert recovered");
                }
                tracing::debug!("inserted {} L2 rows into ClickHouse", rows);
                return;
            }
            Err(err) => {
                attempt = attempt.saturating_add(1);
                metrics.insert_attempts.with_label_values(&["error"]).inc();
                tracing::error!(
                    rows = batch.len(),
                    attempt,
                    retry_in_seconds = delay.as_secs_f64(),
                    error = ?err,
                    "failed to insert L2 batch"
                );
                tokio::time::sleep(delay).await;
                delay = (delay.saturating_mul(2)).min(max_delay);
            }
        }
    }
}

async fn flush_funding_with_retry(
    writer: &ClickHouseClient,
    metrics: &RecorderMetrics,
    batch: Vec<FundingRateRecord>,
    stop_token: CancellationToken,
    insert_async: bool,
    max_backoff_seconds: u64,
) {
    if batch.is_empty() {
        return;
    }
    let max_delay = Duration::from_secs(max_backoff_seconds.max(1));
    let mut delay = INSERT_RETRY_INITIAL_DELAY;
    let mut attempt: u32 = 0;
    loop {
        if stop_token.is_cancelled() {
            return;
        }
        match writer.insert_funding_batch(&batch, insert_async).await {
            Ok((rows, latency)) => {
                metrics
                    .funding_insert_attempts
                    .with_label_values(&["success"])
                    .inc();
                metrics.funding_insert_rows.inc_by(rows as f64);
                metrics.funding_insert_latency_seconds.observe(latency);
                if attempt > 0 {
                    tracing::info!(
                        rows,
                        recovered_after_attempts = attempt,
                        "funding insert recovered"
                    );
                }
                tracing::debug!("inserted {} funding rows into ClickHouse", rows);
                return;
            }
            Err(err) => {
                attempt = attempt.saturating_add(1);
                metrics
                    .funding_insert_attempts
                    .with_label_values(&["error"])
                    .inc();
                tracing::error!(
                    rows = batch.len(),
                    attempt,
                    retry_in_seconds = delay.as_secs_f64(),
                    error = ?err,
                    "failed to insert funding batch"
                );
                tokio::time::sleep(delay).await;
                delay = (delay.saturating_mul(2)).min(max_delay);
            }
        }
    }
}

async fn flush_trades_with_retry(
    writer: &ClickHouseClient,
    metrics: &RecorderMetrics,
    batch: Vec<TradeRecord>,
    stop_token: CancellationToken,
    insert_async: bool,
    max_backoff_seconds: u64,
) {
    if batch.is_empty() {
        return;
    }
    let max_delay = Duration::from_secs(max_backoff_seconds.max(1));
    let mut delay = INSERT_RETRY_INITIAL_DELAY;
    let mut attempt: u32 = 0;
    loop {
        if stop_token.is_cancelled() {
            return;
        }
        match writer.insert_trades_batch(&batch, insert_async).await {
            Ok((rows, latency)) => {
                metrics
                    .insert_trades_attempts
                    .with_label_values(&["success"])
                    .inc();
                metrics.insert_trades_rows.inc_by(rows as f64);
                metrics.insert_trades_latency_seconds.observe(latency);
                if attempt > 0 {
                    tracing::info!(
                        rows,
                        recovered_after_attempts = attempt,
                        "trade insert recovered"
                    );
                }
                tracing::debug!("inserted {} trade rows into ClickHouse", rows);
                return;
            }
            Err(err) => {
                attempt = attempt.saturating_add(1);
                metrics
                    .insert_trades_attempts
                    .with_label_values(&["error"])
                    .inc();
                tracing::error!(
                    rows = batch.len(),
                    attempt,
                    retry_in_seconds = delay.as_secs_f64(),
                    error = ?err,
                    "failed to insert trade batch"
                );
                tokio::time::sleep(delay).await;
                delay = (delay.saturating_mul(2)).min(max_delay);
            }
        }
    }
}
