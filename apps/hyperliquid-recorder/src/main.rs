use std::{collections::HashMap, path::PathBuf, process::ExitCode, sync::Arc, time::Duration};

use anyhow::Result;
use clap::Parser;
use hyperliquid_recorder::{
    clickhouse::ClickHouseClient,
    config::AppConfig,
    health::{HealthState, start_http_servers},
    metrics::RecorderMetrics,
    publisher::Publisher,
    recorder::{RecorderRuntime, WriterRuntimeConfig},
};
use pyth_lazer_protocol::{PriceFeedId, publisher::PriceFeedDataV2};
use tokio::{
    signal::unix::{SignalKind, signal},
    sync::mpsc,
};
use tracing::{error, warn};
use url::Url;

const PUBLISHER_CHANNEL_SIZE: usize = 64;

#[tokio::main]
async fn main() -> ExitCode {
    init_logging();

    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            tracing::error!("fatal error: {err:#}");
            ExitCode::from(1)
        }
    }
}

async fn run() -> Result<()> {
    let cli = Cli::parse();
    let config = AppConfig::from_sources(cli.config.as_deref())?;

    let writer_client = create_client_with_retry(config.clone(), 30).await?;
    let ping_client = create_client_with_retry(config.clone(), 30).await?;

    let metrics = Arc::new(RecorderMetrics::new()?);
    let health = HealthState::new(
        config.markets.iter().map(|m| m.coin.clone()).collect(),
        config.ready_stale_seconds,
    );
    let (health_server, metrics_server) = start_http_servers(
        config.health_port,
        config.metrics_port,
        metrics.clone(),
        health.clone(),
    );

    let (publisher_sender, publisher_receiver) = mpsc::channel(PUBLISHER_CHANNEL_SIZE);

    let mut runtime = RecorderRuntime::new(
        config.quicknode_endpoint,
        config.quicknode_auth_token,
        config.markets,
        writer_client,
        WriterRuntimeConfig {
            batch_max_rows: config.batch_max_rows,
            batch_flush_seconds: config.batch_flush_seconds,
            queue_max_rows: config.queue_max_rows,
        },
        publisher_sender,
        metrics.clone(),
        health.clone(),
        config.reconnect_max_backoff_seconds,
        config.insert_async,
    );
    runtime.start();

    let publisher_task = tokio::spawn(start_publisher_task(
        config.lazer_agent_url,
        publisher_receiver,
    ));

    let mut sigint = signal(SignalKind::interrupt())?;
    let mut sigterm = signal(SignalKind::terminate())?;
    tokio::select! {
        _ = sigint.recv() => tracing::info!("shutdown signal received (SIGINT)"),
        _ = sigterm.recv() => tracing::info!("shutdown signal received (SIGTERM)"),
    }

    runtime.stop().await;
    runtime.wait_forever().await;
    health_server.abort();
    metrics_server.abort();
    publisher_task.abort();
    drop(ping_client);
    Ok(())
}

#[derive(Debug, Parser)]
#[command(name = "hyperliquid-recorder")]
struct Cli {
    /// Path to a YAML config file. Environment variables still override values from this file.
    #[arg(long, value_name = "PATH")]
    config: Option<PathBuf>,
}

async fn create_client_with_retry(
    config: AppConfig,
    max_attempts: usize,
) -> Result<ClickHouseClient> {
    for attempt in 1..=max_attempts {
        let client = ClickHouseClient::new(config.clickhouse.clone());
        if client.ping().await {
            return Ok(client);
        }
        tracing::warn!("clickhouse connection attempt {attempt}/{max_attempts} failed");
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    anyhow::bail!("failed to connect to ClickHouse after startup retries")
}

fn init_logging() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .compact()
        .init();
}

async fn start_publisher_task(url: Option<Url>, mut receiver: mpsc::Receiver<PriceFeedDataV2>) {
    if url.is_none() {
        warn!("publisher in dry-run mode, no actual publishing will happen");
    }

    match Publisher::start(url.clone()).await {
        Ok(mut publisher) => {
            let mut cached = HashMap::<PriceFeedId, PriceFeedDataV2>::new();
            while let Some(update) = receiver.recv().await {
                let merged = cached
                    .entry(update.price_feed_id)
                    .and_modify(|old| {
                        *old = PriceFeedDataV2 {
                            price_feed_id: update.price_feed_id,
                            source_timestamp_us: update
                                .source_timestamp_us
                                .max(old.source_timestamp_us),
                            publisher_timestamp_us: update
                                .publisher_timestamp_us
                                .max(old.source_timestamp_us),
                            price: update.price.or(old.price),
                            best_bid_price: update.best_bid_price.or(old.best_bid_price),
                            best_ask_price: update.best_ask_price.or(old.best_ask_price),
                            funding_rate: update.funding_rate.or(old.funding_rate),
                        };
                    })
                    .or_insert(update);
                if let Err(error) = publisher.publish(merged).await {
                    error!(agent = ?url, %error);
                }
            }
        }
        Err(err) => error!(%err, "could not start publisher"),
    }
}
