use {
    crate::{
        actors::{
            chain_price_listener::ChainPriceListener, controller::Controller,
            price_pusher::PricePusher, pyth_price_listener::PythPriceListener,
            subscription_listener::SubscriptionListener,
        },
        adapters::{
            ethereum::InstrumentedSignablePythContract, hermes::HermesClient,
            types::ReadChainSubscriptions,
        },
        api::BlockchainState,
        config::EthereumConfig,
    },
    backoff::ExponentialBackoff,
    ethers::signers::Signer,
    fortuna::eth_utils::traced_client::RpcMetrics,
    keeper_metrics::KeeperMetrics,
    ractor::Actor,
    std::{sync::Arc, time::Duration},
    tracing,
};

pub(crate) mod keeper_metrics;

#[tracing::instrument(name = "keeper", skip_all, fields(chain_id = chain_state.name))]
pub async fn run_keeper_for_chain(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
    _metrics: Arc<KeeperMetrics>,
    rpc_metrics: Arc<RpcMetrics>,
) {
    tracing::info!("Starting keeper");

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

    // TODO: Make these configurable
    let subscription_poll_interval = Duration::from_secs(60);
    let chain_price_poll_interval = Duration::from_secs(10);
    let controller_update_interval = Duration::from_secs(5);
    let backoff_policy = ExponentialBackoff {
        initial_interval: Duration::from_secs(1),
        max_interval: Duration::from_secs(60),
        multiplier: 2.0,
        max_elapsed_time: Some(Duration::from_secs(300)),
        ..ExponentialBackoff::default()
    };

    let (subscription_listener, _) = Actor::spawn(
        Some(format!("SubscriptionListener-{}", chain_state.name)),
        SubscriptionListener,
        (
            chain_state.name.clone(),
            contract.clone() as Arc<dyn ReadChainSubscriptions + Send + Sync>,
            subscription_poll_interval,
        ),
    )
    .await
    .expect("Failed to spawn SubscriptionListener actor");

    let (pyth_price_listener, _) = Actor::spawn(
        Some(format!("PythPriceListener-{}", chain_state.name)),
        PythPriceListener,
        hermes_client.clone(),
    )
    .await
    .expect(&format!(
        "Failed to spawn PythPriceListener-{} actor",
        chain_state.name
    ));

    let (chain_price_listener, _) = Actor::spawn(
        Some(format!("ChainPriceListener-{}", chain_state.name)),
        ChainPriceListener,
        (
            chain_state.name.clone(),
            contract.clone(),
            chain_price_poll_interval,
        ),
    )
    .await
    .expect(&format!(
        "Failed to spawn ChainPriceListener-{} actor",
        chain_state.name
    ));

    let (price_pusher, _) = Actor::spawn(
        Some(format!("PricePusher-{}", chain_state.name)),
        PricePusher,
        (
            chain_state.name.clone(),
            contract.clone(),
            hermes_client.clone(),
            backoff_policy,
        ),
    )
    .await
    .expect(&format!(
        "Failed to spawn PricePusher-{} actor",
        chain_state.name
    ));

    let (_controller, _) = Actor::spawn(
        Some(format!("Controller-{}", chain_state.name)),
        Controller,
        (
            chain_state.name.clone(),
            subscription_listener,
            pyth_price_listener,
            chain_price_listener,
            price_pusher,
            controller_update_interval,
        ),
    )
    .await
    .expect(&format!(
        "Failed to spawn Controller-{} actor",
        chain_state.name
    ));

    tracing::info!(chain_id = chain_state.name, "Keeper actors started");
}
