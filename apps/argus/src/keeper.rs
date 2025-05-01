use {
    crate::{
        api::BlockchainState, chain::ethereum::InstrumentedSignablePythContract,
        config::EthereumConfig,
    },
    ethers::signers::Signer,
    fortuna::eth_utils::traced_client::RpcMetrics,
    keeper_metrics::KeeperMetrics,
    std::sync::Arc,
    tracing,
};

pub(crate) mod keeper_metrics;

#[tracing::instrument(name = "keeper", skip_all, fields(chain_id = chain_state.id))]
pub async fn run_keeper_threads(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
    _metrics: Arc<KeeperMetrics>,
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
    let _keeper_address = contract.wallet().address();

    // TODO: Spawn actors here
}
