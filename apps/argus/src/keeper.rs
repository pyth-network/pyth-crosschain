use {
    crate::{
        api::{BlockchainState, ChainId},
        chain::ethereum::{InstrumentedPythContract, InstrumentedSignablePythContract},
        config::EthereumConfig,
        keeper::fee::adjust_fee_wrapper,
        keeper::fee::withdraw_fees_wrapper,
        keeper::track::track_accrued_pyth_fees,
        keeper::track::track_balance,
        keeper::track::track_provider,
    },
    ethers::{signers::Signer, types::U256},
    fortuna::eth_utils::traced_client::RpcMetrics,
    keeper_metrics::{AccountLabel, KeeperMetrics},
    std::sync::Arc,
    tokio::{
        spawn,
        time::{self, Duration},
    },
    tracing::{self, Instrument},
};

pub(crate) mod fee;
pub(crate) mod fulfillment_task;
pub(crate) mod keeper_metrics;
pub(crate) mod state;
pub(crate) mod track;

/// Track metrics in this interval
const TRACK_INTERVAL: Duration = Duration::from_secs(10);
/// Check whether we need to conduct a withdrawal at this interval.
const WITHDRAW_INTERVAL: Duration = Duration::from_secs(300);
/// Check whether we need to adjust the fee at this interval.
const ADJUST_FEE_INTERVAL: Duration = Duration::from_secs(30);

/// Run threads to handle events for the last `BACKLOG_RANGE` blocks, watch for new blocks and
/// handle any events for the new blocks.
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

    // Spawn a thread that watches the keeper wallet balance and submits withdrawal transactions as needed to top-up the balance.
    spawn(
        withdraw_fees_wrapper(
            contract.clone(),
            chain_state.provider_address,
            WITHDRAW_INTERVAL,
            U256::from(chain_eth_config.min_keeper_balance),
        )
        .in_current_span(),
    );

    // Spawn a thread that periodically adjusts the provider fee.
    spawn(
        adjust_fee_wrapper(
            contract.clone(),
            chain_state.clone(),
            chain_state.provider_address,
            ADJUST_FEE_INTERVAL,
            chain_eth_config.legacy_tx,
            // NOTE: we are adjusting the fees based on the maximum configured gas for user transactions.
            // However, the keeper will pad the gas limit for transactions (per the escalation policy) to ensure reliable submission.
            // Consequently, fees can be adjusted such that transactions are still unprofitable.
            // While we could scale up this value based on the padding, that ends up overcharging users as most transactions cost nowhere
            // near the maximum gas limit.
            // In the unlikely event that the keeper fees aren't sufficient, the solution to this is to configure the target
            // fee percentage to be higher on that specific chain.

            // TODO: remove this, the gas limit is set by the consumer now.
            chain_eth_config.gas_limit,
            // NOTE: unwrap() here so we panic early if someone configures these values below -100.
            u64::try_from(100 + chain_eth_config.min_profit_pct)
                .expect("min_profit_pct must be >= -100"),
            u64::try_from(100 + chain_eth_config.target_profit_pct)
                .expect("target_profit_pct must be >= -100"),
            u64::try_from(100 + chain_eth_config.max_profit_pct)
                .expect("max_profit_pct must be >= -100"),
            chain_eth_config.fee,
            metrics.clone(),
        )
        .in_current_span(),
    );

    // Spawn a thread to track the provider info and the balance of the keeper
    spawn(
        async move {
            let chain_id = chain_state.id.clone();
            let chain_config = chain_eth_config.clone();
            let provider_address = chain_state.provider_address;
            let keeper_metrics = metrics.clone();
            let contract = match InstrumentedPythContract::from_config(
                &chain_config,
                chain_id.clone(),
                rpc_metrics,
            ) {
                Ok(r) => r,
                Err(e) => {
                    tracing::error!("Error while connecting to pythnet contract. error: {:?}", e);
                    return;
                }
            };

            loop {
                // There isn't a loop for indefinite trials. There is a new thread being spawned every `TRACK_INTERVAL` seconds.
                // If rpc start fails all of these threads will just exit, instead of retrying.
                // We are tracking rpc failures elsewhere, so it's fine.
                spawn(
                    track_provider(
                        chain_id.clone(),
                        contract.clone(),
                        provider_address,
                        keeper_metrics.clone(),
                    )
                    .in_current_span(),
                );
                spawn(
                    track_balance(
                        chain_id.clone(),
                        contract.client(),
                        keeper_address,
                        keeper_metrics.clone(),
                    )
                    .in_current_span(),
                );
                spawn(
                    track_accrued_pyth_fees(
                        chain_id.clone(),
                        contract.clone(),
                        keeper_metrics.clone(),
                    )
                    .in_current_span(),
                );

                time::sleep(TRACK_INTERVAL).await;
            }
        }
        .in_current_span(),
    );
}
