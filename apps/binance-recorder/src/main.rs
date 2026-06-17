use std::{path::PathBuf, process::ExitCode, sync::Arc, time::Duration};

use anyhow::Result;
use binance_recorder::{
    clickhouse::ClickHouseClient,
    config::AppConfig,
    metrics::RecorderMetrics,
    recorder::{RecorderRuntime, WriterRuntimeConfig},
};
use clap::Parser;
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

    tracing::info!(markets = ?config.markets, "starting binance-recorder");

    let writer_client = create_client_with_retry(config.clone(), 30).await?;
    let metrics = Arc::new(RecorderMetrics::new()?);

    let mut runtime = RecorderRuntime::new(
        config.markets,
        config.reconnect_max_backoff_seconds,
        writer_client,
        WriterRuntimeConfig {
            batch_max_rows: config.batch_max_rows,
            batch_flush_seconds: config.batch_flush_seconds,
            queue_max_rows: config.queue_max_rows,
        },
        metrics,
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
    Ok(())
}

#[derive(Debug, Parser)]
#[command(name = "binance-recorder")]
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
