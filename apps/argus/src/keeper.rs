use {
    crate::{
        api::{BlockchainState, ChainId},
        chain::ethereum::{InstrumentedPythContract, InstrumentedSignablePythContract},
        config::EthereumConfig,
        keeper::request::{
            get_latest_safe_block, process_active_requests,
        },
        keeper::fee::adjust_fee_wrapper,
        keeper::fee::withdraw_fees_wrapper,
        keeper::track::track_balance,
        keeper::track::track_provider,
    },
    fortuna::eth_utils::traced_client::RpcMetrics,
    ethers::{signers::Signer, types::U256},
    keeper_metrics::{AccountLabel, KeeperMetrics},
    std::{collections::HashSet, sync::Arc},
    tokio::{
        spawn,
        sync::RwLock,
        time::{self, Duration},
    },
    tracing::{self, Instrument},
};

pub(crate) mod request;
pub(crate) mod fee;
pub(crate) mod keeper_metrics;
pub(crate) mod process_event;
pub(crate) mod track;

/// Track metrics in this interval
const TRACK_INTERVAL: Duration = Duration::from_secs(10);
/// Check whether we need to conduct a withdrawal at this interval.
const WITHDRAW_INTERVAL: Duration = Duration::from_secs(300);
/// Check whether we need to adjust the fee at this interval.
const ADJUST_FEE_INTERVAL: Duration = Duration::from_secs(30);
/// Check for active requests at this interval
const ACTIVE_REQUESTS_INTERVAL: Duration = Duration::from_secs(2);
/// Maximum number of active requests to process in a single batch
const MAX_ACTIVE_REQUESTS: usize = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequestState {
    /// Fulfilled means that the request was either revealed or we are sure we
    /// will not be able to reveal it.
    Fulfilled,
    /// We have already processed the request but couldn't fulfill it and we are
    /// unsure if we can fulfill it or not.
    Processed,
}

/// Run threads to handle active requests, periodically check for new requests,
/// and manage fees and balance.
#[tracing::instrument(name = "keeper", skip_all, fields(chain_id = chain_state.id))]
pub async fn run_keeper_threads(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
    metrics: Arc<KeeperMetrics>,
    rpc_metrics: Arc<RpcMetrics>,
) {
    tracing::info!("starting keeper");
    let latest_safe_block = get_latest_safe_block(&chain_state).in_current_span().await;
    tracing::info!("latest safe block: {}", &latest_safe_block);

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

    let fulfilled_requests_cache = Arc::new(RwLock::new(HashSet::<u64>::new()));

    // Spawn a thread to handle active requests initially
    let gas_limit: U256 = chain_eth_config.gas_limit.into();
    spawn(
        process_active_requests(
            MAX_ACTIVE_REQUESTS,
            contract.clone(),
            gas_limit,
            chain_eth_config.escalation_policy.to_policy(),
            chain_state.clone(),
            metrics.clone(),
            fulfilled_requests_cache.clone(),
        )
        .in_current_span(),
    );

    // Clone values needed for the periodic request checking thread
    let request_check_contract = contract.clone();
    let request_check_chain_state = chain_state.clone();
    let request_check_metrics = metrics.clone();
    let request_check_escalation_policy = chain_eth_config.escalation_policy.to_policy();
    let request_check_fulfilled_requests_cache = fulfilled_requests_cache.clone();

    // Spawn a thread to periodically check for active requests
    spawn(
        async move {
            loop {
                time::sleep(ACTIVE_REQUESTS_INTERVAL).await;

                process_active_requests(
                    MAX_ACTIVE_REQUESTS,
                    request_check_contract.clone(),
                    gas_limit,
                    request_check_escalation_policy.clone(),
                    request_check_chain_state.clone(),
                    request_check_metrics.clone(),
                    request_check_fulfilled_requests_cache.clone(),
                )
                .in_current_span()
                .await;
            }
        }
        .in_current_span(),
    );

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

    // Clone values needed for the fee adjustment thread
    let fee_adjust_contract = contract.clone();
    let fee_adjust_chain_state = chain_state.clone();
    let fee_adjust_metrics = metrics.clone();

    // Spawn a thread that periodically adjusts the provider fee.
    spawn(
        adjust_fee_wrapper(
            fee_adjust_contract,
            fee_adjust_chain_state.clone(),
            fee_adjust_chain_state.provider_address,
            ADJUST_FEE_INTERVAL,
            chain_eth_config.legacy_tx,
            // NOTE: we are adjusting the fees based on the maximum configured gas for user transactions.
            // However, the keeper will pad the gas limit for transactions (per the escalation policy) to ensure reliable submission.
            // Consequently, fees can be adjusted such that transactions are still unprofitable.
            // While we could scale up this value based on the padding, that ends up overcharging users as most transactions cost nowhere
            // near the maximum gas limit.
            // In the unlikely event that the keeper fees aren't sufficient, the solution to this is to configure the target
            // fee percentage to be higher on that specific chain.
            chain_eth_config.gas_limit,
            // NOTE: unwrap() here so we panic early if someone configures these values below -100.
            u64::try_from(100 + chain_eth_config.min_profit_pct)
                .expect("min_profit_pct must be >= -100"),
            u64::try_from(100 + chain_eth_config.target_profit_pct)
                .expect("target_profit_pct must be >= -100"),
            u64::try_from(100 + chain_eth_config.max_profit_pct)
                .expect("max_profit_pct must be >= -100"),
            chain_eth_config.fee,
            fee_adjust_metrics,
        )
        .in_current_span(),
    );

    // Clone values needed for the tracking thread
    let track_chain_id = chain_state.id.clone();
    let track_chain_config = chain_eth_config.clone();
    let track_provider_address = chain_state.provider_address;
    let track_keeper_metrics = metrics.clone();
    let track_rpc_metrics = rpc_metrics.clone();

    // Spawn a thread to track the provider info and the balance of the keeper
    spawn(
        async move {
            let chain_id = track_chain_id;
            let chain_config = track_chain_config;
            let provider_address = track_provider_address;
            let keeper_metrics = track_keeper_metrics;
            let contract = match InstrumentedPythContract::from_config(
                &chain_config,
                chain_id.clone(),
                track_rpc_metrics,
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

                time::sleep(TRACK_INTERVAL).await;
            }
        }
        .in_current_span(),
    );
}
