//! This module contains the main entrypoint for the Argus service.

use {
    crate::{
        adapters::{ethereum::InstrumentedSignablePythContract, hermes::HermesClient},
        api,
        config::{Config, EthereumConfig, RunOptions},
        metrics::KeeperMetrics,
        services::{
            ChainPriceService, ControllerService, PricePusherService, PythPriceService, Service,
            SubscriptionService,
        },
        state::ArgusState,
    },
    anyhow::{anyhow, Error, Result},
    backoff::ExponentialBackoff,
    ethers::signers::Signer,
    fortuna::eth_utils::traced_client::RpcMetrics,
    prometheus_client::registry::Registry,
    std::sync::Arc,
    tokio::{
        spawn,
        sync::{watch, RwLock},
    },
    tracing,
};

/// Run Argus and the API server
pub async fn run(opts: &RunOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    let (exit_tx, exit_rx) = watch::channel(false);
    let metrics_registry = Arc::new(RwLock::new(Registry::default()));
    let rpc_metrics = Arc::new(RpcMetrics::new(metrics_registry.clone()).await);
    let keeper_private_key = config
        .keeper
        .private_key
        .load()?
        .expect("Keeper private key not found in config");

    let chain_labels: Vec<String> = config.chains.keys().cloned().collect();
    let keeper_metrics = Arc::new(KeeperMetrics::new(metrics_registry.clone(), chain_labels).await);

    if config.chains.is_empty() {
        return Err(anyhow!("No chains were configured"));
    }

    // Spawn a task to listen for Ctrl+C so we can trigger a graceful shutdown
    spawn(async move {
        tracing::info!("Registered shutdown signal handler");
        tokio::signal::ctrl_c().await.unwrap();
        tracing::info!("Shutdown signal received, waiting for tasks to exit");
        // No need to handle error here, as this can only error if all of the
        // receivers have been dropped, which is what we want to do
        exit_tx.send(true)?;

        Ok::<(), Error>(())
    });

    // Run keeper services for all chains
    let mut handles = Vec::new();
    for (chain_name, chain_config) in &config.chains {
        handles.push(spawn(run_keeper_for_chain(
            keeper_private_key.clone(),
            chain_config.clone(),
            chain_name.clone(),
            keeper_metrics.clone(),
            rpc_metrics.clone(),
            exit_rx.clone(),
            config.clone(),
        )));
    }

    // Run API server for metrics and health checks
    api::run_api_server(opts.addr, metrics_registry, exit_rx).await?;

    Ok(())
}

/// Run keeper services for the given chain
#[tracing::instrument(skip_all, fields(chain_name))]
pub async fn run_keeper_for_chain(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_name: String,
    _metrics: Arc<KeeperMetrics>, // TODO: add metrics
    rpc_metrics: Arc<RpcMetrics>,
    exit_rx: watch::Receiver<bool>,
    config: Config,
) -> Result<()> {
    tracing::info!("Starting keeper for chain {}", chain_name);

    // TODO: create a contract with a WS provider if geth_rpc_wss was provided
    let contract = Arc::new(
        InstrumentedSignablePythContract::from_config(
            &chain_eth_config,
            &private_key,
            chain_name.clone(),
            rpc_metrics.clone(),
        )
        .await
        .expect(&format!(
            "Failed to create InstrumentedSignablePythContract from config for chain {}",
            chain_name
        )),
    );

    let keeper_address = contract.wallet().address();
    tracing::info!(
        keeper_address = %keeper_address,
        "Keeper address"
    );

    let state = Arc::new(ArgusState::new());

    let hermes_client = Arc::new(HermesClient);
    let backoff_policy = ExponentialBackoff {
        initial_interval: config.keeper.backoff_initial_interval,
        max_interval: config.keeper.backoff_max_interval,
        multiplier: config.keeper.backoff_multiplier,
        max_elapsed_time: Some(config.keeper.backoff_max_elapsed_time),
        ..ExponentialBackoff::default()
    };

    let subscription_service = SubscriptionService::new(
        chain_name.clone(),
        contract.clone(),
        config.keeper.subscription_poll_interval,
        state.subscription_state.clone(),
        state.pyth_price_state.clone(),
        state.chain_price_state.clone(),
    );

    let pyth_price_service = PythPriceService::new(
        chain_name.clone(),
        config.keeper.pyth_price_poll_interval,
        hermes_client.clone(),
        state.pyth_price_state.clone(),
    );

    let chain_price_service = ChainPriceService::new(
        chain_name.clone(),
        contract.clone(),
        config.keeper.chain_price_poll_interval,
        state.chain_price_state.clone(),
    );

    let price_pusher_service = PricePusherService::new(
        chain_name.clone(),
        contract.clone(),
        hermes_client.clone(),
        backoff_policy,
    );

    let controller_service = ControllerService::new(
        chain_name.clone(),
        config.keeper.controller_update_interval,
        state.subscription_state.clone(),
        state.pyth_price_state.clone(),
        state.chain_price_state.clone(),
    );

    let services: Vec<Arc<dyn Service>> = vec![
        Arc::new(subscription_service),
        Arc::new(pyth_price_service),
        Arc::new(chain_price_service),
        Arc::new(price_pusher_service),
        Arc::new(controller_service),
    ];

    let mut handles = Vec::new();
    for service in services {
        let service_stop_rx = exit_rx.clone();

        let handle = tokio::spawn(async move {
            let service_name = service.name().to_string();
            match service.start(service_stop_rx).await {
                Ok(_) => {
                    tracing::info!(service = service_name, "Service stopped gracefully");
                }
                Err(e) => {
                    tracing::error!(
                        service = service_name,
                        error = %e,
                        "Service stopped with error"
                    );
                }
            }
        });

        handles.push(handle);
    }

    tracing::info!("Keeper services started");

    for handle in handles {
        let _ = handle.await;
    }

    Ok(())
}
