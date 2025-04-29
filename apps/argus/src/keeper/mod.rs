use {
    crate::{
        api::BlockchainState,
        chain::ethereum::InstrumentedSignablePythContract,
        chain_price_listener::{ChainPriceListener, EthereumChainPriceListener},
        config::EthereumConfig,
        controller::{Controller, PulseController},
        keeper::keeper_metrics::KeeperMetrics,
        metrics::{ControllerMetrics, PricePusherMetrics},
        price_pusher::{EthereumPricePusher, PricePusher},
        pyth_price_listener::{HermesPythPriceListener, PythPriceListener},
        subscription_listener::{EthereumSubscriptionListener, SubscriptionListener},
    },
    anyhow::Result,
    ethers::signers::Signer,
    fortuna::eth_utils::traced_client::RpcMetrics,
    std::{sync::Arc, time::Duration},
    tokio::spawn,
    tracing,
};

pub(crate) mod keeper_metrics;

const DEFAULT_UPDATE_INTERVAL: Duration = Duration::from_secs(5);

const DEFAULT_HERMES_WS_URL: &str = "wss://hermes.pyth.network/ws";

const DEFAULT_HERMES_API_URL: &str = "https://hermes.pyth.network/api";

#[tracing::instrument(name = "keeper", skip_all, fields(chain_id = chain_state.id))]
pub async fn run_keeper_threads(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
    metrics: Arc<KeeperMetrics>,
    rpc_metrics: Arc<RpcMetrics>,
) {
    tracing::info!("starting keeper");

    let contract = Arc::new(
        InstrumentedSignablePythContract::from_config(
            &chain_eth_config,
            &private_key,
            chain_state.id.clone(),
            rpc_metrics.clone(),
        )
        .await
        .expect("Chain config should be valid"),
    );
    let keeper_address = contract.wallet().address();
    tracing::info!("Keeper address: {}", keeper_address);

    let read_contract = Arc::new(
        crate::chain::ethereum::InstrumentedPythContract::from_config(
            &chain_eth_config,
            chain_state.id.clone(),
            rpc_metrics.clone(),
        )
        .expect("Chain config should be valid"),
    );

    let registry = metrics.registry();
    let controller_metrics = Arc::new(
        ControllerMetrics::new(registry.clone(), chain_state.id.clone()).await
    );
    let price_pusher_metrics = Arc::new(
        PricePusherMetrics::new(registry.clone(), chain_state.id.clone()).await
    );

    let subscription_listener = Arc::new(
        EthereumSubscriptionListener::new(
            read_contract.clone(),
            contract.clone(),
            chain_eth_config.clone(),
        )
    );

    let pyth_price_listener = Arc::new(
        HermesPythPriceListener::new(
            DEFAULT_HERMES_WS_URL.to_string(),
        )
    );

    let chain_price_listener = Arc::new(
        EthereumChainPriceListener::new(
            read_contract.clone(),
            chain_eth_config.clone(),
        )
    );

    let price_pusher = Arc::new(
        EthereumPricePusher::new(
            contract.clone(),
            chain_eth_config.clone(),
            pyth_price_listener.clone(),
            price_pusher_metrics.clone(),
            DEFAULT_HERMES_API_URL.to_string(),
        )
    );

    let controller = Arc::new(
        PulseController::new(
            chain_state.id.clone(),
            subscription_listener,
            pyth_price_listener,
            chain_price_listener,
            price_pusher,
            controller_metrics,
            DEFAULT_UPDATE_INTERVAL,
        )
    );

    if let Err(err) = controller.initialize().await {
        tracing::error!("Failed to initialize controller: {}", err);
        return;
    }

    spawn(async move {
        if let Err(err) = controller.run().await {
            tracing::error!("Controller error: {}", err);
        }
    });
}
