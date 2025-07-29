use {
    crate::{
        api::{BlockchainState, ChainId},
        chain::ethereum::{InstrumentedPythContract, InstrumentedSignablePythContract},
        config::{EthereumConfig, KeeperConfig},
        eth_utils::traced_client::RpcMetrics,
        history::History,
        keeper::{
            block::{
                get_latest_safe_block, process_backlog, process_new_blocks, watch_blocks_wrapper,
                BlockRange, ProcessParams,
            },
            commitment::update_commitments_loop,
            fee::{adjust_fee_wrapper, withdraw_fees_wrapper},
            track::{
                track_accrued_pyth_fees, track_balance, track_block_timestamp_lag, track_provider,
            },
        },
    },
    anyhow,
    ethers::{
        signers::{LocalWallet, Signer},
        types::U256,
    },
    keeper_metrics::{AccountLabel, KeeperMetrics},
    std::{collections::HashSet, str::FromStr, sync::Arc},
    tokio::{
        spawn,
        sync::{mpsc, RwLock},
        time::{self, Duration},
    },
    tracing::{self, Instrument},
};

pub(crate) mod block;
pub(crate) mod commitment;
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequestState {
    /// Fulfilled means that the request was either revealed or we are sure we
    /// will not be able to reveal it.
    Fulfilled,
    /// We have already processed the request but couldn't fulfill it and we are
    /// unsure if we can fulfill it or not.
    Processed,
}

/// Run threads to handle events for the last `BACKLOG_RANGE` blocks, watch for new blocks and
/// handle any events for the new blocks.
#[allow(clippy::too_many_arguments)] // Top level orchestration function that needs to configure several threads
#[tracing::instrument(name = "keeper", skip_all, fields(chain_id = chain_state.id))]
pub async fn run_keeper_threads(
    keeper_config: KeeperConfig,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
    metrics: Arc<KeeperMetrics>,
    history: Arc<History>,
    rpc_metrics: Arc<RpcMetrics>,
) -> anyhow::Result<()> {
    tracing::info!("Starting keeper");
    let latest_safe_block = get_latest_safe_block(&chain_state).in_current_span().await;
    tracing::info!("Latest safe block: {}", &latest_safe_block);

    let keeper_private_key = keeper_config.private_key.load()?.ok_or_else(|| {
        anyhow::anyhow!("Keeper private key is required but not provided in config")
    })?;

    // Contract that uses the keeper wallet to send transactions
    let contract = Arc::new(InstrumentedSignablePythContract::from_config(
        &chain_eth_config,
        &keeper_private_key,
        chain_state.id.clone(),
        rpc_metrics.clone(),
        chain_state.network_id,
    )?);
    let keeper_address = contract.wallet().address();

    let fulfilled_requests_cache = Arc::new(RwLock::new(HashSet::<u64>::new()));

    // Spawn a thread to handle the events from last backlog_range blocks.
    let process_params = ProcessParams {
        chain_state: chain_state.clone(),
        contract: contract.clone(),
        escalation_policy: chain_eth_config.escalation_policy.to_policy(),
        replica_config: keeper_config.replica_config.clone(),
        metrics: metrics.clone(),
        fulfilled_requests_cache,
        history,
    };
    spawn(
        process_backlog(
            process_params.clone(),
            BlockRange {
                from: latest_safe_block.saturating_sub(chain_eth_config.backlog_range),
                to: latest_safe_block,
            },
            chain_eth_config.block_delays.clone(),
        )
        .in_current_span(),
    );

    let (tx, rx) = mpsc::channel::<BlockRange>(1000);
    // Spawn a thread to watch for new blocks and send the range of blocks for which events has not been handled to the `tx` channel.
    spawn(watch_blocks_wrapper(chain_state.clone(), latest_safe_block, tx).in_current_span());

    // Spawn a thread for block processing with configured delays
    spawn(
        process_new_blocks(
            process_params.clone(),
            rx,
            chain_eth_config.block_delays.clone(),
        )
        .in_current_span(),
    );

    // If fee manager private key is provided, spawn fee withdrawal and adjustment threads
    let fee_manager_private_key = if let Some(ref secret) = keeper_config.fee_manager_private_key {
        secret.load()?
    } else {
        None
    };

    if let Some(fee_manager_private_key) = fee_manager_private_key.clone() {
        let contract_as_fee_manager = Arc::new(InstrumentedSignablePythContract::from_config(
            &chain_eth_config,
            &fee_manager_private_key,
            chain_state.id.clone(),
            rpc_metrics.clone(),
            chain_state.network_id,
        )?);

        // Spawn a thread that periodically withdraws fees to the fee manager and keeper.
        spawn(
            withdraw_fees_wrapper(
                contract_as_fee_manager.clone(),
                chain_state.provider_address,
                WITHDRAW_INTERVAL,
                U256::from(chain_eth_config.min_keeper_balance),
                keeper_address,
                keeper_config.other_keeper_addresses.clone(),
            )
            .in_current_span(),
        );

        // Spawn a thread that periodically adjusts the provider fee.
        spawn(
            adjust_fee_wrapper(
                contract_as_fee_manager.clone(),
                chain_state.clone(),
                chain_state.provider_address,
                ADJUST_FEE_INTERVAL,
                chain_eth_config.legacy_tx,
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
    } else {
        tracing::warn!(
            "Fee manager private key not provided - fee withdrawal and adjustment threads will not run."
        );
    }

    spawn(update_commitments_loop(contract.clone(), chain_state.clone()).in_current_span());

    // Spawn a thread to track the provider info and the balance of the keeper & fee manager
    spawn(
        async move {
            let chain_id = chain_state.id.clone();
            let chain_config = chain_eth_config.clone();
            let provider_address = chain_state.provider_address;
            let keeper_metrics = metrics.clone();
            let fee_manager_address_option = fee_manager_private_key.as_ref().and_then(
                |private_key| match LocalWallet::from_str(private_key) {
                    Ok(wallet) => Some(wallet.address()),
                    Err(e) => {
                        tracing::error!("Invalid fee manager private key: {:?}", e);
                        None
                    }
                },
            );

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
                time::sleep(TRACK_INTERVAL).await;

                // Track provider info and balance sequentially. Note that the tracking is done sequentially with the
                // timestamp last. If there is a persistent error in any of these methods, the timestamp will lag behind
                // current time and trigger an alert.
                if let Err(e) = track_provider(
                    chain_id.clone(),
                    contract.clone(),
                    provider_address,
                    keeper_metrics.clone(),
                )
                .await
                {
                    tracing::error!("Error tracking provider: {:?}", e);
                    continue;
                }

                if let Err(e) = track_balance(
                    chain_id.clone(),
                    contract.client(),
                    keeper_address,
                    keeper_metrics.clone(),
                )
                .await
                {
                    tracing::error!("Error tracking balance for keeper: {:?}", e);
                    continue;
                }

                if let Some(fee_manager_address) = fee_manager_address_option {
                    if fee_manager_address != keeper_address {
                        if let Err(e) = track_balance(
                            chain_id.clone(),
                            contract.client(),
                            fee_manager_address,
                            keeper_metrics.clone(),
                        )
                        .await
                        {
                            tracing::error!("Error tracking balance for fee manager: {:?}", e);
                            continue;
                        }
                    }
                }
                if let Err(e) = track_accrued_pyth_fees(
                    chain_id.clone(),
                    contract.clone(),
                    keeper_metrics.clone(),
                )
                .await
                {
                    tracing::error!("Error tracking accrued pyth fees: {:?}", e);
                    continue;
                }

                if let Err(e) = track_block_timestamp_lag(
                    chain_id.clone(),
                    contract.client(),
                    keeper_metrics.clone(),
                )
                .await
                {
                    tracing::error!("Error tracking block timestamp lag: {:?}", e);
                    continue;
                }
            }
        }
        .in_current_span(),
    );
    Ok(())
}
