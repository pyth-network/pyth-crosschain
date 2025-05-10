use anyhow::Result;
use backoff::ExponentialBackoff;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tracing;

use crate::adapters;
use crate::adapters::types::ReadPythPrices;
use crate::adapters::{
    ethereum::InstrumentedSignablePythContract, hermes::HermesClient, types::ReadChainSubscriptions,
};
use crate::api::BlockchainState;
use crate::config::EthereumConfig;
use crate::keeper::keeper_metrics::KeeperMetrics;
use crate::services::{
    ChainPriceService, ControllerService, PricePusherService, PythPriceService, Service,
    SubscriptionService,
};
use crate::state::ArgusState;
use ethers::signers::Signer;
use fortuna::eth_utils::traced_client::RpcMetrics;

#[tracing::instrument(name = "keeper_shared", skip_all, fields(chain_id = chain_state.name))]
pub async fn run_keeper_for_chain(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
    _metrics: Arc<KeeperMetrics>,
    rpc_metrics: Arc<RpcMetrics>,
) -> Result<()> {
    tracing::info!("Starting keeper with shared memory architecture");

    let contract = Arc::new(
        InstrumentedSignablePythContract::from_config(
            &chain_eth_config,
            &private_key,
            chain_state.name.clone(),
            rpc_metrics.clone(),
        )
        .await
        .expect(&format!(
            "Failed to create InstrumentedSignablePythContract from config for chain {}",
            chain_state.name
        )),
    );

    let keeper_address = contract.wallet().address();
    tracing::info!(
        chain_id = chain_state.name,
        keeper_address = %keeper_address,
        "Keeper address"
    );

    let hermes_client = Arc::new(HermesClient);

    let state = Arc::new(ArgusState::new(chain_state.name.clone()));

    let (stop_tx, stop_rx) = watch::channel(false);
    {
        let mut stop_sender = state.stop_sender.lock().expect("Mutex poisoned");
        *stop_sender = Some(stop_tx);
    }

    let subscription_poll_interval = Duration::from_secs(60);
    let chain_price_poll_interval = Duration::from_secs(10);
    let pyth_price_poll_interval = Duration::from_secs(5);
    let controller_update_interval = Duration::from_secs(5);
    let backoff_policy = ExponentialBackoff {
        initial_interval: Duration::from_secs(1),
        max_interval: Duration::from_secs(60),
        multiplier: 2.0,
        max_elapsed_time: Some(Duration::from_secs(300)),
        ..ExponentialBackoff::default()
    };

    let subscription_service = SubscriptionService::new(
        chain_state.name.clone(),
        contract.clone(),
        subscription_poll_interval,
        state.subscription_state.clone(),
        state.pyth_price_state.clone(),
        state.chain_price_state.clone(),
    );

    let pyth_price_service = PythPriceService::new(
        chain_state.name.clone(),
        pyth_price_poll_interval,
        hermes_client.clone(),
        state.pyth_price_state.clone(),
    );

    let chain_price_service = ChainPriceService::new(
        chain_state.name.clone(),
        contract.clone(),
        chain_price_poll_interval,
        state.chain_price_state.clone(),
    );

    let price_pusher_service = PricePusherService::new(
        chain_state.name.clone(),
        contract.clone(),
        hermes_client.clone(),
        backoff_policy,
    );

    let controller_service = ControllerService::new(
        chain_state.name.clone(),
        controller_update_interval,
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
        let service_stop_rx = stop_rx.clone();

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

    tracing::info!(chain_id = chain_state.name, "Keeper services started");

    for handle in handles {
        let _ = handle.await;
    }

    Ok(())
}
