use serde::Deserialize;
use {
    crate::lazer_publisher::LazerPublisher,
    anyhow::Context,
    clap::Parser,
    tracing::{info, level_filters::LevelFilter},
    tracing_subscriber::{EnvFilter, fmt::format::FmtSpan},
};

mod config;
mod http_server;
mod jrpc_handle;
mod lazer_publisher;
mod publisher_handle;
pub mod relayer_session;
mod websocket_utils;

#[derive(Parser, Deserialize)]
#[command(version)]
struct Cli {
    #[clap(short, long, default_value = "config/config.toml")]
    config: String,
    #[clap(short, long, default_value = "json")]
    log_format: LogFormat,
}

#[derive(clap::ValueEnum, Clone, Deserialize, Default)]
enum LogFormat {
    #[default]
    Json,
    Compact,
    Pretty,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Cli::parse();
    init_tracing_subscriber(args.log_format);

    let config =
        config::load_config(args.config.to_string()).context("Failed to read config file")?;
    info!(?config, "starting lazer-agent");

    let lazer_publisher = LazerPublisher::new(&config).await;
    http_server::run(config, lazer_publisher).await?;

    Ok(())
}

fn init_tracing_subscriber(log_format: LogFormat) {
    #[allow(
        clippy::expect_used,
        reason = "application can fail on invalid RUST_LOG"
    )]
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::builder()
                .with_default_directive(LevelFilter::INFO.into())
                .from_env()
                .expect("invalid RUST_LOG env var"),
        )
        .with_span_events(FmtSpan::NONE);

    match log_format {
        LogFormat::Json => {
            subscriber.json().with_span_list(false).init();
        }
        LogFormat::Compact => {
            subscriber.compact().init();
        }
        LogFormat::Pretty => {
            subscriber.pretty().init();
        }
    }
}
