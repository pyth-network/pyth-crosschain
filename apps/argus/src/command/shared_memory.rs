use {
    crate::{
        api::{self, BlockchainState},
        config::Config,
        config::RunOptions,
        keeper,
    },
    anyhow::Result,
    fortuna::eth_utils::traced_client::RpcMetrics,
    keeper::keeper_metrics::KeeperMetrics,
    std::sync::Arc,
    tokio,
    tracing,
};

pub async fn run(opts: &RunOptions) -> Result<()> {
    tracing::info!("Starting Argus with shared memory approach");

    let bind_addr = opts.bind_addr.parse()?;
    let (api_handle, api_shutdown) = api::listen_and_serve(bind_addr);

    let config = Config::load(&opts.config.config)?;

    let private_key = config
        .keeper
        .private_key
        .load()?
        .ok_or(anyhow::anyhow!("Missing private key"))?;

    let blockchain_states: Vec<BlockchainState> = config
        .chains
        .keys()
        .map(|chain_id| BlockchainState {
            name: chain_id.clone(),
            last_processed_block: None,
        })
        .collect();

    let metrics = Arc::new(KeeperMetrics::new());
    let rpc_metrics = Arc::new(RpcMetrics::default());

    for blockchain in blockchain_states.iter() {
        let chain_id = blockchain.name.clone();
        let chain_config = config.get_chain_config(&chain_id)?;
        let blockchain_clone = blockchain.clone();
        let metrics_clone = metrics.clone();
        let rpc_metrics_clone = rpc_metrics.clone();
        let private_key_clone = private_key.clone();

        tokio::spawn(async move {
            keeper::run_keeper_for_chain(
                private_key_clone,
                chain_config,
                blockchain_clone,
                metrics_clone,
                rpc_metrics_clone,
            )
            .await;
        });
    }

    tokio::signal::ctrl_c().await?;
    tracing::info!("Shutting down...");

    api_shutdown.send(())?;
    api_handle.await??;

    Ok(())
}
