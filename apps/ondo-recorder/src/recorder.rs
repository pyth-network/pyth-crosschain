use std::{sync::Arc, time::Duration};

use tokio::{
    sync::mpsc,
    task::JoinHandle,
    time::{Instant, MissedTickBehavior},
};
use tokio_util::sync::CancellationToken;

use crate::{
    clickhouse::ClickHouseClient, config::TokenConfig, health::HealthState,
    metrics::RecorderMetrics, models::OndoQuote, poller::run_poller_for_token,
};

#[derive(Clone, Debug)]
pub struct WriterRuntimeConfig {
    pub batch_max_rows: usize,
    pub batch_flush_seconds: f64,
    pub queue_max_rows: usize,
}

pub struct RecorderRuntime {
    api_url: String,
    api_key: String,
    duration: String,
    tokens: Vec<TokenConfig>,
    poll_interval: Duration,
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
        api_url: String,
        api_key: String,
        duration: String,
        tokens: Vec<TokenConfig>,
        poll_interval: Duration,
        writer: ClickHouseClient,
        writer_config: WriterRuntimeConfig,
        metrics: Arc<RecorderMetrics>,
        health: HealthState,
        insert_async: bool,
    ) -> Self {
        Self {
            api_url,
            api_key,
            duration,
            tokens,
            poll_interval,
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
        let (tx, rx) = mpsc::channel::<OndoQuote>(self.writer_config.queue_max_rows);
        self.spawn_writer_loop(rx);

        let http_client = reqwest::Client::new();
        for token in self.tokens.clone() {
            let handle = tokio::spawn(run_poller_for_token(
                http_client.clone(),
                self.api_url.clone(),
                self.api_key.clone(),
                self.duration.clone(),
                token,
                self.poll_interval,
                tx.clone(),
                self.metrics.clone(),
                self.health.clone(),
                self.stop_token.clone(),
            ));
            self.handles.push(handle);
        }

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

    fn spawn_writer_loop(&mut self, mut receiver: mpsc::Receiver<OndoQuote>) {
        let writer = self.writer.clone();
        let metrics = self.metrics.clone();
        let batch_max_rows = self.writer_config.batch_max_rows;
        let batch_flush_seconds = self.writer_config.batch_flush_seconds;
        let queue_max_rows = self.writer_config.queue_max_rows;
        let stop_token = self.stop_token.clone();
        let insert_async = self.insert_async;

        let handle = tokio::spawn(async move {
            let mut buffer: Vec<OndoQuote> = Vec::with_capacity(batch_max_rows);
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
                    Ok(Some(quote)) => {
                        buffer.push(quote);
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
                    let batch = std::mem::take(&mut buffer);
                    flush_with_retry(&writer, &metrics, batch, stop_token.clone(), insert_async)
                        .await;
                    last_flush = Instant::now();
                }
            }

            if !buffer.is_empty() {
                flush_with_retry(&writer, &metrics, buffer, stop_token, insert_async).await;
            }
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

async fn flush_with_retry(
    writer: &ClickHouseClient,
    metrics: &RecorderMetrics,
    batch: Vec<OndoQuote>,
    stop_token: CancellationToken,
    insert_async: bool,
) {
    if batch.is_empty() {
        return;
    }
    loop {
        if stop_token.is_cancelled() {
            return;
        }
        match writer.insert_quotes_batch(&batch, insert_async).await {
            Ok((rows, latency)) => {
                metrics
                    .insert_attempts
                    .with_label_values(&["success"])
                    .inc();
                metrics.insert_rows.inc_by(rows as f64);
                metrics.insert_latency_seconds.observe(latency);
                tracing::info!("inserted {} quote rows into ClickHouse", rows);
                return;
            }
            Err(err) => {
                metrics.insert_attempts.with_label_values(&["error"]).inc();
                tracing::error!(
                    rows = batch.len(),
                    error = ?err,
                    "failed to insert quote batch"
                );
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
    }
}
