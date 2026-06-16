use std::{path::PathBuf, process::ExitCode, time::Duration};

use anyhow::Result;
use binance_recorder::{clickhouse::ClickHouseClient, config::AppConfig};
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
    tracing::info!(?config, symbols = ?config.symbols, "loaded binance-recorder config");

    let client = create_client_with_retry(config.clone(), 30).await?;
    tracing::info!(reachable = client.ping().await, "connected to ClickHouse");

    // Slice 1 is the offline skeleton: config loading, the hand-rolled SBE
    // decoder, and ClickHouse persistence are wired and unit-tested here, but
    // the live SBE/WebSocket ingestion lane lands in Slice 2. Until then we hold
    // the process open so the runtime start/stop + signal-handling path exists.
    tracing::warn!("live SBE ingestion lane not yet wired (arrives in Slice 2); idling");

    let mut sigint = signal(SignalKind::interrupt())?;
    let mut sigterm = signal(SignalKind::terminate())?;
    tokio::select! {
        _ = sigint.recv() => tracing::info!("shutdown signal received (SIGINT)"),
        _ = sigterm.recv() => tracing::info!("shutdown signal received (SIGTERM)"),
    }

    tracing::info!("shutting down");
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
