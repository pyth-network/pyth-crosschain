use {
    crate::{
        chain::ethereum::{InstrumentedPythContract, InstrumentedSignablePythContract},
        config::{Config, DebugGasOptions},
        eth_utils::{traced_client::RpcMetrics, utils::estimate_tx_cost},
    },
    anyhow::Result,
    ethers::providers::Middleware,
    prometheus_client::registry::Registry,
    std::sync::Arc,
    tokio::{sync::RwLock, time::Duration},
};

const POLL_INTERVAL: Duration = Duration::from_secs(2);

pub async fn debug_gas(opts: &DebugGasOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    let chain_config = config.get_chain_config(&opts.chain_id)?;

    // Create metrics registry for the instrumented contract
    let metrics_registry = Arc::new(RwLock::new(Registry::default()));
    let rpc_metrics = Arc::new(RpcMetrics::new(metrics_registry.clone()).await);

    // Get network_id by creating a temporary contract
    let temp_contract = InstrumentedPythContract::from_config(
        &chain_config,
        opts.chain_id.clone(),
        rpc_metrics.clone(),
    )?;
    let network_id = temp_contract.get_network_id().await?.as_u64();

    // Get the keeper private key
    let keeper_private_key =
        config.keeper.private_key.load()?.ok_or_else(|| {
            anyhow::anyhow!("Keeper private key is required for debug_gas command")
        })?;

    // Instantiate InstrumentedSignablePythContract
    let contract = Arc::new(InstrumentedSignablePythContract::from_config(
        &chain_config,
        &keeper_private_key,
        opts.chain_id.clone(),
        rpc_metrics,
        network_id,
    )?);

    tracing::info!("Starting gas price debugger for chain: {}", opts.chain_id);
    tracing::info!("Watching for new blocks and calling estimate_tx_cost on each block...");
    tracing::info!("Press Ctrl+C to stop");

    let middleware = contract.client().clone();
    let mut last_block_number: Option<u64> = None;

    loop {
        // Get the latest block number
        let latest_block = match middleware.get_block_number().await {
            Ok(block_num) => block_num.as_u64(),
            Err(e) => {
                tracing::error!("Failed to get latest block number: {}", e);
                tokio::time::sleep(POLL_INTERVAL).await;
                continue;
            }
        };

        // Check if we have a new block
        if let Some(last) = last_block_number {
            if latest_block <= last {
                tokio::time::sleep(POLL_INTERVAL).await;
                continue;
            }
        }

        // New block detected, estimate transaction cost
        let gas_limit: u128 = chain_config.gas_limit as u128;
        match estimate_tx_cost(middleware.clone(), chain_config.legacy_tx, gas_limit).await {
            Ok(tx_cost) => {
                let tx_cost_eth = tx_cost as f64 / 1e18;
                let effective_gas_price = tx_cost / gas_limit;
                let effective_gas_price_gwei = effective_gas_price as f64 / 1e9;
                tracing::info!(
                    "Block {}: tx_cost ({} gas) = {} ETH ({} wei), effective_gas_price = {} gwei ({} wei)",
                    latest_block,
                    gas_limit,
                    tx_cost_eth,
                    tx_cost,
                    effective_gas_price_gwei,
                    effective_gas_price
                );
            }
            Err(e) => {
                tracing::error!(
                    "Block {}: Failed to estimate transaction cost: {}",
                    latest_block,
                    e
                );
            }
        }

        last_block_number = Some(latest_block);
        tokio::time::sleep(POLL_INTERVAL).await;
    }
}
