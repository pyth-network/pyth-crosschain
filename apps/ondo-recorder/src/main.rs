use std::{path::PathBuf, process::ExitCode, sync::Arc, time::Duration};

use anyhow::Result;
use clap::Parser;
use ondo_recorder::{
    clickhouse::ClickHouseClient,
    config::AppConfig,
    health::{start_http_servers, HealthState, Market},
    metrics::RecorderMetrics,
    recorder::{RecorderRuntime, WriterRuntimeConfig},
};
use tokio::signal::unix::{signal, SignalKind};

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

    let metrics = Arc::new(RecorderMetrics::new()?);
    let health = HealthState::new(
        config
            .tokens
            .iter()
            .map(|t| Market::new(t.symbol.clone(), t.chain_id.clone()))
            .collect(),
        config.ready_stale_seconds,
    );
    let (health_server, metrics_server) = start_http_servers(
        config.health_port,
        config.metrics_port,
        metrics.clone(),
        health.clone(),
    );

    let mut runtime = RecorderRuntime::new(
        config.api_url,
        config.api_key,
        config.duration,
        config.tokens,
        Duration::from_secs_f64(config.poll_interval_seconds),
        writer_client,
        WriterRuntimeConfig {
            batch_max_rows: config.batch_max_rows,
            batch_flush_seconds: config.batch_flush_seconds,
            queue_max_rows: config.queue_max_rows,
        },
        metrics.clone(),
        health.clone(),
        config.insert_async,
    );
    runtime.start();

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
    Ok(())
}

#[derive(Debug, Parser)]
#[command(name = "ondo-recorder")]
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
