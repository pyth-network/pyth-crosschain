use {
    crate::lazer_publisher::LazerPublisher,
    anyhow::Context,
    clap::Parser,
    tracing::{info, level_filters::LevelFilter},
    tracing_subscriber::{EnvFilter, fmt::format::FmtSpan},
};

mod config;
mod http_server;
mod lazer_publisher;
mod publisher_handle;
mod relayer_session;
mod websocket_utils;

#[derive(Parser)]
#[command(version)]
struct Cli {
    #[clap(short, long, default_value = "config/config.toml")]
    config: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::builder()
                .with_default_directive(LevelFilter::INFO.into())
                .from_env()
                .expect("invalid RUST_LOG env var"),
        )
        .with_span_events(FmtSpan::NONE)
        .json()
        .with_span_list(false)
        .init();

    let args = Cli::parse();
    let config =
        config::load_config(args.config.to_string()).context("Failed to read config file")?;
    info!(?config, "starting lazer-agent");

    let lazer_publisher = LazerPublisher::new(&config).await;
    http_server::run(config, lazer_publisher).await?;

    Ok(())
}
