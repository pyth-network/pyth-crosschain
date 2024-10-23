use std::env;
use std::sync::Arc;

use benchmarks_keeper::{config::Config, run};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config_path = env::var("CONFIG_PATH").ok();
    let config = Config::new(config_path.as_deref())?;
    run(Arc::new(config)).await?;

    Ok(())
}
