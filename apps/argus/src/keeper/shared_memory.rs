use {
    crate::{
        adapters::{
            ethereum::InstrumentedSignablePythContract, hermes::HermesClient,
            types::ReadChainSubscriptions,
        },
        api::BlockchainState,
        config::EthereumConfig,
        shared::{
            state::ArgusSharedState,
            tasks::{
                ChainPriceListenerTask, PricePusherTask, PythPriceListenerTask,
                SubscriptionListenerTask, TaskController,
            },
        },
    },
    anyhow::Result,
    fortuna::eth_utils::traced_client::RpcMetrics,
    keeper_metrics::KeeperMetrics,
    std::{sync::Arc, time::Duration},
    tokio::task::JoinHandle,
    tracing,
};

pub(crate) mod keeper_metrics;

struct TaskHandles {
    controller_handle: JoinHandle<Result<()>>,
    subscription_listener_handle: JoinHandle<Result<()>>,
    pyth_price_listener_handle: JoinHandle<Result<()>>,
    chain_price_listener_handle: JoinHandle<Result<()>>,
    price_pusher_handle: JoinHandle<Result<()>>,
}

impl TaskHandles {
    pub fn abort_all(&self) {
        self.controller_handle.abort();
        self.subscription_listener_handle.abort();
        self.pyth_price_listener_handle.abort();
        self.chain_price_listener_handle.abort();
        self.price_pusher_handle.abort();
    }
}

#[tracing::instrument(name = "keeper", skip_all, fields(chain_id = chain_state.name))]
pub async fn run_keeper_for_chain(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
    _metrics: Arc<KeeperMetrics>,
    rpc_metrics: Arc<RpcMetrics>,
) {
    tracing::info!("Starting keeper with shared memory approach");

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

    let subscription_poll_interval = Duration::from_secs(60);
    let chain_price_poll_interval = Duration::from_secs(10);
    let controller_update_interval = Duration::from_secs(5);

    let shared_state = Arc::new(ArgusSharedState::new());

    let controller = TaskController::new(
        chain_state.name.clone(),
        shared_state.clone(),
        controller_update_interval,
    );
    let stop_token = controller.stop_token();

    let subscription_listener = SubscriptionListenerTask::new(
        chain_state.name.clone(),
        shared_state.clone(),
        subscription_poll_interval,
    );

    let pyth_price_listener = PythPriceListenerTask::new(
        chain_state.name.clone(),
        shared_state.clone(),
    );

    let chain_price_listener = ChainPriceListenerTask::new(
        chain_state.name.clone(),
        shared_state.clone(),
        chain_price_poll_interval,
    );

    let price_pusher = PricePusherTask::new(
        chain_state.name.clone(),
        shared_state.clone(),
    );

    let task_handles = TaskHandles {
        controller_handle: tokio::spawn(controller.start_update_loop()),
        subscription_listener_handle: tokio::spawn(subscription_listener.run(stop_token.clone())),
        pyth_price_listener_handle: tokio::spawn(pyth_price_listener.run(stop_token.clone())),
        chain_price_listener_handle: tokio::spawn(chain_price_listener.run(stop_token.clone())),
        price_pusher_handle: tokio::spawn(price_pusher.run(stop_token)),
    };

    tracing::info!(chain_id = chain_state.name, "Keeper tasks started");

}
