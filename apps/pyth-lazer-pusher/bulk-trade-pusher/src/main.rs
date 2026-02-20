use anyhow::Context as _;
use clap::Parser;
use pusher_base::AppRuntime;
use std::time::Duration;
use tokio::signal;
use tracing::{error, info, level_filters::LevelFilter, warn};
use tracing_subscriber::{fmt::format::FmtSpan, EnvFilter};

const GRACEFUL_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(15);

mod bulk_client;
mod config;
mod health;
mod metrics;
mod pusher;
mod signing;

#[derive(Parser)]
#[command(name = "bulk-pusher")]
#[command(about = "Pushes Pyth Lazer price feeds to Bulk Trade validators")]
struct Cli {
    #[clap(short, long, default_value = "config.toml")]
    config: String,

    #[clap(short = 'V', long)]
    version: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    std::panic::set_hook(Box::new(|info| {
        eprintln!("PANIC: {info}");
        std::process::exit(1);
    }));

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::builder()
                .with_default_directive(LevelFilter::INFO.into())
                .from_env()
                .context("invalid RUST_LOG env var")?,
        )
        .with_span_events(FmtSpan::NONE)
        .json()
        .with_span_list(false)
        .init();

    let args = Cli::parse();

    if args.version {
        println!("{} {}", env!("CARGO_PKG_NAME"), env!("CARGO_PKG_VERSION"));
        return Ok(());
    }

    let config = config::load_config(&args.config).context("failed to load config")?;
    info!(?config, "starting bulk-pusher");

    metrics::init_metrics(config.base.prometheus_address).context("failed to init metrics")?;

    let required_feeds: Vec<u32> = config
        .base
        .feeds
        .subscriptions
        .iter()
        .map(|s| s.feed_id)
        .collect();

    let runtime = AppRuntime::new();

    let health_address = config.health_address;
    runtime.spawn(async move {
        health::start_health_server(health_address, required_feeds).await;
    });

    let pusher_runtime = runtime.clone();
    let pusher_handle = runtime.spawn(async move { pusher::run(config, pusher_runtime).await });

    tokio::select! {
        _ = shutdown_signal() => {
            info!("received shutdown signal, initiating graceful shutdown");
        }
        result = pusher_handle => {
            match result {
                Ok(Ok(())) => warn!("pusher exited unexpectedly"),
                Ok(Err(e)) => error!(?e, "pusher failed"),
                Err(e) => error!(?e, "pusher task error"),
            }
            std::process::exit(1);
        }
    }

    runtime.shutdown();

    if runtime.wait_for_tasks(GRACEFUL_SHUTDOWN_TIMEOUT).await {
        info!("all tasks completed, shutdown complete");
    } else {
        warn!(
            "shutdown timed out after {:?}, some tasks may not have completed",
            GRACEFUL_SHUTDOWN_TIMEOUT
        );
    }

    Ok(())
}

#[allow(
    clippy::expect_used,
    reason = "signal handlers are critical and should panic if they fail"
)]
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
