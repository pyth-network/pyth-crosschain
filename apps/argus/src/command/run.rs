use {
    crate::{
        config::Config,
        contract::{PulseContract, PulseContractImpl},
        error::Result,
        keeper::Keeper,
    },
    alloy::providers::Provider,
    prometheus_client::registry::Registry,
    std::sync::Arc,
    tokio::sync::RwLock,
};

pub struct ChainState<P: Provider> {
    pub id: String,
    pub contract: Arc<PulseContractImpl<P>>,
    pub keeper: Arc<Keeper<PulseContractImpl<P>>>,
}

pub async fn run(config_path: &str) -> Result<()> {
    // Initialize logging with env filter
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Load config
    let config = Config::load(config_path)?;

    // Initialize metrics registry
    let metrics_registry = Arc::new(RwLock::new(Registry::default()));

    // Initialize chain states
    let mut chain_states = Vec::new();
    for (chain_id, chain_config) in config.chains.iter() {
        let provider = Provider::try_from(&chain_config.geth_rpc_addr)?;

        let contract = Arc::new(PulseContractImpl::new(
            provider,
            chain_config.contract_addr,
        ));

        let keeper = Arc::new(Keeper::new(
            contract.clone(),
            chain_config.poll_interval,
            chain_config.min_batch_size,
            chain_config.max_batch_size,
            chain_config.batch_timeout,
        ));

        chain_states.push(ChainState {
            id: chain_id.clone(),
            contract,
            keeper,
        });
    }

    // Start keeper tasks
    let mut keeper_handles = Vec::new();
    for chain_state in &chain_states {
        let keeper = chain_state.keeper.clone();
        keeper_handles.push(tokio::spawn(async move {
            keeper.run().await
        }));
    }

    // TODO: Start API server

    // Wait for shutdown signal
    tokio::signal::ctrl_c().await?;

    Ok(())
}

pub async fn run_test() -> Result<()> {
    use crate::contract::tests::MockPulseContract;
    use crate::hermes::tests::MockHermesClient;

    let contract = Arc::new(MockPulseContract::new());
    let hermes = Arc::new(MockHermesClient::new());

    let keeper = Arc::new(Keeper::new(
        contract.clone(),
        hermes,
        1,  // poll_interval
        1,  // min_batch_size
        10, // max_batch_size
        30, // batch_timeout
    ));

    keeper.run().await
}
