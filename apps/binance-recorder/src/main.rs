use std::{path::PathBuf, process::ExitCode, time::Duration};

use anyhow::Result;
use binance_recorder::{
    clickhouse::ClickHouseClient, config::AppConfig, models::BookTicker,
    stream_client::run_stream_worker,
};
use clap::Parser;
use tokio::{
    signal::unix::{signal, SignalKind},
    sync::mpsc,
};
use tokio_util::sync::CancellationToken;

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

    let client = create_client_with_retry(config.clone(), 30).await?;

    let stop = CancellationToken::new();
    // Tracer slice: direct per-message inserts, no dedupe/batching yet (that
    // lands in the next slice). A small buffer is plenty for one symbol.
    let (tx, mut rx) = mpsc::channel::<BookTicker>(10_000);

    let writer_client = client.clone();
    let insert_async = config.insert_async;
    let writer = tokio::spawn(async move {
        while let Some(ticker) = rx.recv().await {
            match writer_client.insert_batch(&[ticker], insert_async).await {
                Ok((rows, latency)) => {
                    tracing::info!(
                        rows,
                        latency_seconds = latency,
                        "inserted book ticker row(s)"
                    )
                }
                Err(err) => tracing::error!(error = ?err, "failed to insert book ticker row"),
            }
        }
    });

    let symbols = vec![config.symbol.clone()];
    let reconnect_delay_ms = config.ws_reconnect_delay_ms;
    let stream_stop = stop.clone();
    let worker = tokio::spawn(async move {
        if let Err(err) = run_stream_worker(symbols, reconnect_delay_ms, tx, stream_stop).await {
            tracing::error!(error = ?err, "stream worker failed");
        }
    });

    let mut sigint = signal(SignalKind::interrupt())?;
    let mut sigterm = signal(SignalKind::terminate())?;
    tokio::select! {
        _ = sigint.recv() => tracing::info!("shutdown signal received (SIGINT)"),
        _ = sigterm.recv() => tracing::info!("shutdown signal received (SIGTERM)"),
    }

    stop.cancel();
    // Worker drops its senders on exit, which closes the channel and lets the
    // writer drain and finish.
    let _ = worker.await;
    let _ = writer.await;
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
