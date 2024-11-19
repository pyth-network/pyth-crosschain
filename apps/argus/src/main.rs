use {
    crate::{
        keeper::{Keeper, KeeperMetrics},
        storage::{StorageMetrics, StoragePoller},
        types::PriceUpdateRequest,
    },
    anyhow::Result,
    clap::Parser,
    std::{sync::Arc, time::Duration},
    tokio::sync::{mpsc, RwLock},
};

mod keeper;
mod storage;
mod types;

#[derive(Parser)]
struct Opts {
    #[clap(long, default_value = "config.yaml")]
    config: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Parse command line arguments
    let opts = Opts::parse();

    // Initialize metrics registry
    let metrics_registry = Arc::new(RwLock::new(prometheus_client::registry::Registry::default()));

    // Load config
    let config = config::load_config(&opts.config)?;

    // Set up channel between storage poller and keeper
    let (request_tx, request_rx) = mpsc::channel(1000);

    // Initialize metrics
    let storage_metrics = Arc::new(StorageMetrics {
        requests_found: Counter::default(),
        polling_errors: Counter::default(),
    });

    let keeper_metrics = Arc::new(KeeperMetrics {
        transactions_submitted: Counter::default(),
        transaction_failures: Counter::default(),
        gas_used: Histogram::new([1.0, 5.0, 10.0, 50.0, 100.0, 500.0, 1000.0].into_iter()),
        batch_size: Histogram::new([1.0, 2.0, 5.0, 10.0, 20.0, 50.0].into_iter()),
    });

    // Register metrics
    {
        let mut registry = metrics_registry.write().await;
        // Register all metrics...
    }

    // Initialize components
    let provider = Arc::new(config.create_provider()?);

    let storage_poller = StoragePoller::new(
        provider.clone(),
        config.contract_address,
        Duration::from_secs(config.poll_interval),
        request_tx,
        storage_metrics,
    ).await?;

    let mut keeper = Keeper::new(
        provider,
        config.create_hot_wallet()?,
        config.create_cold_wallet()?,
        request_rx,
        keeper_metrics,
        config.min_batch_size,
        config.max_batch_size,
        Duration::from_secs(config.batch_timeout),
    ).await?;

    // Start components
    let storage_handle = tokio::spawn(async move {
        storage_poller.start_polling().await
    });

    let keeper_handle = tokio::spawn(async move {
        keeper.run().await
    });

    // Wait for components to finish
    tokio::try_join!(storage_handle, keeper_handle)?;

    Ok(())
}
