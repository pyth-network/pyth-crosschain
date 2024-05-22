use {
    crate::{
        api::{
            self,
            BlockchainState,
        },
        chain::{
            ethereum::{
                PythContract,
                SignablePythContract,
            },
            reader::{
                BlockNumber,
                RequestedWithCallbackEvent,
            },
        },
        config::EthereumConfig,
    },
    anyhow::{
        anyhow,
        Result,
    },
    ethers::{
        contract::ContractError,
        providers::{
            Http,
            Middleware,
            Provider,
            Ws,
        },
        signers::Signer,
        types::{
            Address,
            U256,
        },
    },
    futures::StreamExt,
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{
            counter::Counter,
            family::Family,
            gauge::Gauge,
        },
        registry::Registry,
    },
    std::{
        collections::HashMap,
        sync::{
            atomic::AtomicU64,
            Arc,
        },
    },
    tokio::{
        spawn,
        sync::{
            mpsc,
            RwLock,
        },
        time::{
            self,
            Duration,
        },
    },
    tracing::{
        self,
        Instrument,
    },
};

/// How much to wait before retrying in case of an RPC error
const RETRY_INTERVAL: Duration = Duration::from_secs(5);
/// How many blocks to look back for events that might be missed when starting the keeper
const BACKLOG_RANGE: u64 = 1000;
/// How many blocks to fetch events for in a single rpc call
const BLOCK_BATCH_SIZE: u64 = 100;
/// How much to wait before polling the next latest block
const POLL_INTERVAL: Duration = Duration::from_secs(2);
/// Track metrics in this interval
const TRACK_INTERVAL: Duration = Duration::from_secs(10);
/// Rety last N blocks
const RETRY_PREVIOUS_BLOCKS: u64 = 100;

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct AccountLabel {
    pub chain_id: String,
    pub address:  String,
}

#[derive(Default)]
pub struct KeeperMetrics {
    pub current_sequence_number: Family<AccountLabel, Gauge>,
    pub end_sequence_number:     Family<AccountLabel, Gauge>,
    pub balance:                 Family<AccountLabel, Gauge<f64, AtomicU64>>,
    pub collected_fee:           Family<AccountLabel, Gauge<f64, AtomicU64>>,
    pub total_gas_spent:         Family<AccountLabel, Gauge<f64, AtomicU64>>,
    pub requests:                Family<AccountLabel, Counter>,
    pub requests_processed:      Family<AccountLabel, Counter>,
    pub requests_reprocessed:    Family<AccountLabel, Counter>,
    pub reveals:                 Family<AccountLabel, Counter>,
}

impl KeeperMetrics {
    pub async fn new(registry: Arc<RwLock<Registry>>) -> Self {
        let mut writable_registry = registry.write().await;
        let keeper_metrics = KeeperMetrics::default();

        writable_registry.register(
            "current_sequence_number",
            "The sequence number for a new request",
            keeper_metrics.current_sequence_number.clone(),
        );

        writable_registry.register(
            "end_sequence_number",
            "The sequence number for the end request",
            keeper_metrics.end_sequence_number.clone(),
        );

        writable_registry.register(
            "requests",
            "Number of requests received through events",
            keeper_metrics.requests.clone(),
        );

        writable_registry.register(
            "requests_processed",
            "Number of requests processed",
            keeper_metrics.requests_processed.clone(),
        );

        writable_registry.register(
            "reveal",
            "Number of reveals",
            keeper_metrics.reveals.clone(),
        );

        writable_registry.register(
            "balance",
            "Balance of the keeper",
            keeper_metrics.balance.clone(),
        );

        writable_registry.register(
            "collected_fee",
            "Collected fee on the contract",
            keeper_metrics.collected_fee.clone(),
        );

        writable_registry.register(
            "total_gas_spent",
            "Total gas spent revealing requests",
            keeper_metrics.total_gas_spent.clone(),
        );

        writable_registry.register(
            "requests_reprocessed",
            "Number of requests reprocessed",
            keeper_metrics.requests_reprocessed.clone(),
        );

        keeper_metrics
    }
}

#[derive(Debug)]
pub struct BlockRange {
    pub from: BlockNumber,
    pub to:   BlockNumber,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequestState {
    /// Fulfilled means that the request was either revealed or we are sure we
    /// will not be able to reveal it.
    Fulfilled,
    /// We have already processed the request but couldn't fulfill it and we are
    /// unsure if we can fulfill it or not.
    Processed,
}

/// Get the latest safe block number for the chain. Retry internally if there is an error.
async fn get_latest_safe_block(chain_state: &BlockchainState) -> BlockNumber {
    loop {
        match chain_state
            .contract
            .get_block_number(chain_state.confirmed_block_status)
            .await
        {
            Ok(latest_confirmed_block) => {
                tracing::info!(
                    "Fetched latest safe block {}",
                    latest_confirmed_block - chain_state.reveal_delay_blocks
                );
                return latest_confirmed_block - chain_state.reveal_delay_blocks;
            }
            Err(e) => {
                tracing::error!("Error while getting block number. error: {:?}", e);
                time::sleep(RETRY_INTERVAL).await;
            }
        }
    }
}

/// Run threads to handle events for the last `BACKLOG_RANGE` blocks, watch for new blocks and
/// handle any events for the new blocks.
#[tracing::instrument(name="keeper", skip_all, fields(chain_id=chain_state.id))]
pub async fn run_keeper_threads(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
    metrics: Arc<RwLock<Registry>>,
) {
    // Register metrics
    let keeper_metrics = Arc::new(KeeperMetrics::new(metrics.clone()).await);

    tracing::info!("starting keeper");
    let latest_safe_block = get_latest_safe_block(&chain_state).in_current_span().await;
    tracing::info!("latest safe block: {}", &latest_safe_block);

    let contract = Arc::new(
        SignablePythContract::from_config(&chain_eth_config, &private_key)
            .await
            .expect("Chain config should be valid"),
    );
    let keeper_address = contract.client().inner().inner().signer().address();

    let fulfilled_requests_cache = Arc::new(RwLock::new(HashMap::<u64, RequestState>::new()));

    // Spawn a thread to handle the events from last BACKLOG_RANGE blocks.
    let gas_limit: U256 = chain_eth_config.gas_limit.into();
    spawn(
        process_backlog(
            BlockRange {
                from: latest_safe_block.saturating_sub(BACKLOG_RANGE),
                to:   latest_safe_block,
            },
            contract.clone(),
            gas_limit,
            chain_state.clone(),
            keeper_metrics.clone(),
            fulfilled_requests_cache.clone(),
        )
        .in_current_span(),
    );

    let (tx, rx) = mpsc::channel::<BlockRange>(1000);
    // Spawn a thread to watch for new blocks and send the range of blocks for which events has not been handled to the `tx` channel.
    spawn(
        watch_blocks_wrapper(
            chain_state.clone(),
            latest_safe_block,
            tx,
            chain_eth_config.geth_rpc_wss.clone(),
        )
        .in_current_span(),
    );
    // Spawn a thread that listens for block ranges on the `rx` channel and processes the events for those blocks.
    spawn(
        process_new_blocks(
            chain_state.clone(),
            rx,
            Arc::clone(&contract),
            gas_limit,
            keeper_metrics.clone(),
            fulfilled_requests_cache.clone(),
        )
        .in_current_span(),
    );

    // Spawn a thread to track the provider info and the balance of the keeper
    spawn(
        async move {
            let chain_id = chain_state.id.clone();
            let chain_config = chain_eth_config.clone();
            let provider_address = chain_state.provider_address.clone();
            let keeper_metrics = keeper_metrics.clone();

            loop {
                // There isn't a loop for indefinite trials. There is a new thread being spawned every `TRACK_INTERVAL` seconds.
                // If rpc start fails all of these threads will just exit, instead of retrying.
                // We are tracking rpc failures elsewhere, so it's fine.
                spawn(
                    track_provider(
                        chain_id.clone(),
                        chain_config.clone(),
                        provider_address.clone(),
                        keeper_metrics.clone(),
                    )
                    .in_current_span(),
                );
                spawn(
                    track_balance(
                        chain_id.clone(),
                        chain_config.clone(),
                        keeper_address.clone(),
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


/// Process an event for a chain. It estimates the gas for the reveal with callback and
/// submits the transaction if the gas estimate is below the gas limit.
/// It will return an Error if the gas estimation failed with a provider error or if the
/// reveal with callback failed with a provider error.
pub async fn process_event(
    event: RequestedWithCallbackEvent,
    chain_config: &BlockchainState,
    contract: &Arc<SignablePythContract>,
    gas_limit: U256,
    metrics: Arc<KeeperMetrics>,
    fulfilled_requests_cache: Arc<RwLock<HashMap<u64, RequestState>>>,
) -> Result<()> {
    if chain_config.provider_address != event.provider_address {
        fulfilled_requests_cache
            .write()
            .await
            .insert(event.sequence_number, RequestState::Fulfilled);
        return Ok(());
    }
    let provider_revelation = match chain_config.state.reveal(event.sequence_number) {
        Ok(result) => result,
        Err(e) => {
            tracing::error!(
                sequence_number = &event.sequence_number,
                "Error while revealing with error: {:?}",
                e
            );
            fulfilled_requests_cache
                .write()
                .await
                .insert(event.sequence_number, RequestState::Fulfilled);
            return Ok(());
        }
    };

    let gas_estimate_res = chain_config
        .contract
        .estimate_reveal_with_callback_gas(
            event.provider_address,
            event.sequence_number,
            event.user_random_number,
            provider_revelation,
        )
        .in_current_span()
        .await;

    match gas_estimate_res {
        Ok(gas_estimate_option) => match gas_estimate_option {
            Some(gas_estimate) => {
                // Pad the gas estimate by 33%
                let (gas_estimate, _) = gas_estimate
                    .saturating_mul(U256::from(4))
                    .div_mod(U256::from(3));

                if gas_estimate > gas_limit {
                    tracing::error!(
                        sequence_number = &event.sequence_number,
                        "Gas estimate for reveal with callback is higher than the gas limit"
                    );

                    fulfilled_requests_cache
                        .write()
                        .await
                        .insert(event.sequence_number, RequestState::Fulfilled);
                    return Ok(());
                }

                let contract_call = contract
                    .reveal_with_callback(
                        event.provider_address,
                        event.sequence_number,
                        event.user_random_number,
                        provider_revelation,
                    )
                    .gas(gas_estimate);

                let res = contract_call.send().await;

                let pending_tx = match res {
                    Ok(pending_tx) => pending_tx,
                    Err(e) => match e {
                        // If there is a provider error, we weren't able to send the transaction.
                        // We will return an error. So, that the caller can decide what to do (retry).
                        ContractError::ProviderError { e } => return Err(e.into()),
                        // For all the other errors, it is likely the case we won't be able to reveal for
                        // ever. We will return an Ok(()) to signal that we have processed this reveal
                        // and concluded that its Ok to not reveal.
                        _ => {
                            fulfilled_requests_cache
                                .write()
                                .await
                                .insert(event.sequence_number, RequestState::Processed);
                            tracing::error!(
                                sequence_number = &event.sequence_number,
                                "Error while revealing with error: {:?}",
                                e
                            );
                            return Ok(());
                        }
                    },
                };

                match pending_tx.await {
                    Ok(res) => match res {
                        Some(res) => {
                            tracing::info!(
                                sequence_number = &event.sequence_number,
                                transaction_hash = &res.transaction_hash.to_string(),
                                gas_used = ?res.gas_used,
                                "Revealed with res: {:?}",
                                res
                            );

                            if let Some(gas_used) = res.gas_used {
                                let gas_used = gas_used.as_u128() as f64 / 1e18;
                                metrics
                                    .total_gas_spent
                                    .get_or_create(&AccountLabel {
                                        chain_id: chain_config.id.clone(),
                                        address:  contract
                                            .client()
                                            .inner()
                                            .inner()
                                            .signer()
                                            .address()
                                            .to_string(),
                                    })
                                    .inc_by(gas_used);
                            }

                            metrics
                                .reveals
                                .get_or_create(&AccountLabel {
                                    chain_id: chain_config.id.clone(),
                                    address:  chain_config.provider_address.to_string(),
                                })
                                .inc();

                            fulfilled_requests_cache
                                .write()
                                .await
                                .insert(event.sequence_number, RequestState::Fulfilled);
                            Ok(())
                        }
                        None => {
                            tracing::error!(
                                sequence_number = &event.sequence_number,
                                "Can't verify the reveal"
                            );
                            // It is better to return an error in this scenario
                            // For the caller to retry
                            Err(anyhow!("Can't verify the reveal"))
                        }
                    },

                    Err(e) => {
                        tracing::error!(
                            sequence_number = &event.sequence_number,
                            "Error while revealing with error: {:?}",
                            e
                        );
                        Err(e.into())
                    }
                }
            }
            None => {
                tracing::info!(
                    sequence_number = &event.sequence_number,
                    "Not fulfilling event"
                );
                fulfilled_requests_cache
                    .write()
                    .await
                    .insert(event.sequence_number, RequestState::Processed);
                Ok(())
            }
        },
        Err(e) => {
            tracing::error!(
                sequence_number = &event.sequence_number,
                "Error while simulating reveal with error: {:?}",
                e
            );
            Err(e)
        }
    }
}


/// Process a range of blocks in batches. It calls the `process_single_block_batch` method for each batch.
#[tracing::instrument(skip_all, fields(range_from_block=block_range.from, range_to_block=block_range.to))]
pub async fn process_block_range(
    block_range: BlockRange,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
    chain_state: api::BlockchainState,
    metrics: Arc<KeeperMetrics>,
    fulfilled_requests_cache: Arc<RwLock<HashMap<u64, RequestState>>>,
) {
    let BlockRange {
        from: first_block,
        to: last_block,
    } = block_range;
    let mut current_block = first_block;
    while current_block <= last_block {
        let mut to_block = current_block + BLOCK_BATCH_SIZE;
        if to_block > last_block {
            to_block = last_block;
        }

        // TODO: this is handling all blocks sequentially we might want to handle them in parallel in future.
        process_single_block_batch(
            BlockRange {
                from: current_block,
                to:   to_block,
            },
            contract.clone(),
            gas_limit,
            chain_state.clone(),
            metrics.clone(),
            fulfilled_requests_cache.clone(),
        )
        .in_current_span()
        .await;

        current_block = to_block + 1;
    }
}

/// Process a batch of blocks for a chain. It will fetch events for all the blocks in a single call for the provided batch
/// and then try to process them one by one. It checks the `fulfilled_request_cache`. If the request was already fulfilled.
/// It won't reprocess it. If the request was already processed, it will reprocess it.
/// If the process fails, it will retry indefinitely.
#[tracing::instrument(name="batch", skip_all, fields(batch_from_block=block_range.from, batch_to_block=block_range.to))]
pub async fn process_single_block_batch(
    block_range: BlockRange,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
    chain_state: api::BlockchainState,
    metrics: Arc<KeeperMetrics>,
    fulfilled_requests_cache: Arc<RwLock<HashMap<u64, RequestState>>>,
) {
    loop {
        let events_res = chain_state
            .contract
            .get_request_with_callback_events(block_range.from, block_range.to)
            .await;

        match events_res {
            Ok(events) => {
                tracing::info!(num_of_events = &events.len(), "Processing",);
                for event in &events {
                    if let Some(state) = fulfilled_requests_cache
                        .read()
                        .await
                        .get(&event.sequence_number)
                    {
                        match state {
                            RequestState::Fulfilled => {
                                tracing::info!(
                                    sequence_number = &event.sequence_number,
                                    "Skipping already fulfilled request",
                                );
                                continue;
                            }
                            RequestState::Processed => {
                                tracing::info!(
                                    sequence_number = &event.sequence_number,
                                    "Reprocessing already processed request",
                                );
                                metrics
                                    .requests_reprocessed
                                    .get_or_create(&AccountLabel {
                                        chain_id: chain_state.id.clone(),
                                        address:  chain_state.provider_address.to_string(),
                                    })
                                    .inc();
                            }
                        }
                    }
                    metrics
                        .requests
                        .get_or_create(&AccountLabel {
                            chain_id: chain_state.id.clone(),
                            address:  chain_state.provider_address.to_string(),
                        })
                        .inc();
                    tracing::info!(sequence_number = &event.sequence_number, "Processing event",);
                    while let Err(e) = process_event(
                        event.clone(),
                        &chain_state,
                        &contract,
                        gas_limit,
                        metrics.clone(),
                        fulfilled_requests_cache.clone(),
                    )
                    .in_current_span()
                    .await
                    {
                        tracing::error!(
                            sequence_number = &event.sequence_number,
                            "Error while processing event. Waiting for {} seconds before retry. error: {:?}",
                            RETRY_INTERVAL.as_secs(),
                            e
                        );
                        time::sleep(RETRY_INTERVAL).await;
                    }
                    tracing::info!(sequence_number = &event.sequence_number, "Processed event",);
                    metrics
                        .requests_processed
                        .get_or_create(&AccountLabel {
                            chain_id: chain_state.id.clone(),
                            address:  chain_state.provider_address.to_string(),
                        })
                        .inc();
                }
                tracing::info!(num_of_events = &events.len(), "Processed",);
                break;
            }
            Err(e) => {
                tracing::error!(
                    "Error while getting events. Waiting for {} seconds before retry. error: {:?}",
                    RETRY_INTERVAL.as_secs(),
                    e
                );
                time::sleep(RETRY_INTERVAL).await;
            }
        }
    }
}

/// Wrapper for the `watch_blocks` method. If there was an error while watching, it will retry after a delay.
/// It retries indefinitely.
#[tracing::instrument(name="watch_blocks", skip_all, fields(initial_safe_block=latest_safe_block))]
pub async fn watch_blocks_wrapper(
    chain_state: BlockchainState,
    latest_safe_block: BlockNumber,
    tx: mpsc::Sender<BlockRange>,
    geth_rpc_wss: Option<String>,
) {
    let mut last_safe_block_processed = latest_safe_block;
    loop {
        if let Err(e) = watch_blocks(
            chain_state.clone(),
            &mut last_safe_block_processed,
            tx.clone(),
            geth_rpc_wss.clone(),
        )
        .in_current_span()
        .await
        {
            tracing::error!("watching blocks. error: {:?}", e);
            time::sleep(RETRY_INTERVAL).await;
        }
    }
}

/// Watch for new blocks and send the range of blocks for which events have not been handled to the `tx` channel.
/// We are subscribing to new blocks instead of events. If we miss some blocks, it will be fine as we are sending
/// block ranges to the `tx` channel. If we have subscribed to events, we could have missed those and won't even
/// know about it.
pub async fn watch_blocks(
    chain_state: BlockchainState,
    last_safe_block_processed: &mut BlockNumber,
    tx: mpsc::Sender<BlockRange>,
    geth_rpc_wss: Option<String>,
) -> Result<()> {
    tracing::info!("Watching blocks to handle new events");

    let provider_option = match geth_rpc_wss {
        Some(wss) => Some(match Provider::<Ws>::connect(wss.clone()).await {
            Ok(provider) => provider,
            Err(e) => {
                tracing::error!("Error while connecting to wss: {}. error: {:?}", wss, e);
                return Err(e.into());
            }
        }),
        None => {
            tracing::info!("No wss provided");
            None
        }
    };

    let mut stream_option = match provider_option {
        Some(ref provider) => Some(match provider.subscribe_blocks().await {
            Ok(client) => client,
            Err(e) => {
                tracing::error!("Error while subscribing to blocks. error {:?}", e);
                return Err(e.into());
            }
        }),
        None => None,
    };

    loop {
        match stream_option {
            Some(ref mut stream) => {
                if let None = stream.next().await {
                    tracing::error!("Error blocks subscription stream ended");
                    return Err(anyhow!("Error blocks subscription stream ended"));
                }
            }
            None => {
                time::sleep(POLL_INTERVAL).await;
            }
        }

        let latest_safe_block = get_latest_safe_block(&chain_state).in_current_span().await;
        if latest_safe_block > *last_safe_block_processed {
            let mut from = latest_safe_block
                .checked_sub(RETRY_PREVIOUS_BLOCKS)
                .unwrap_or(0);

            // In normal situation, the difference between latest and last safe block should not be more than 2-3 (for arbitrum it can be 10)
            // TODO: add a metric for this in separate PR. We need alerts
            // But in extreme situation, where we were unable to send the block range multiple times, the difference between latest_safe_block and
            // last_safe_block_processed can grow. It is fine to not have the retry mechanisms for those earliest blocks as we expect the rpc
            // to be in consistency after this much time.
            if from > *last_safe_block_processed {
                from = *last_safe_block_processed;
            }
            match tx
                .send(BlockRange {
                    from,
                    to: latest_safe_block,
                })
                .await
            {
                Ok(_) => {
                    tracing::info!(
                        from_block = from,
                        to_block = &latest_safe_block,
                        "Block range sent to handle events",
                    );
                    *last_safe_block_processed = latest_safe_block;
                }
                Err(e) => {
                    tracing::error!(
                        from_block = from,
                        to_block = &latest_safe_block,
                        "Error while sending block range to handle events. These will be handled in next call. error: {:?}",
                        e
                    );
                }
            };
        }
    }
}

/// It waits on rx channel to receive block ranges and then calls process_block_range to process them.
#[tracing::instrument(skip_all)]
pub async fn process_new_blocks(
    chain_state: BlockchainState,
    mut rx: mpsc::Receiver<BlockRange>,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
    metrics: Arc<KeeperMetrics>,
    fulfilled_requests_cache: Arc<RwLock<HashMap<u64, RequestState>>>,
) {
    tracing::info!("Waiting for new block ranges to process");
    loop {
        if let Some(block_range) = rx.recv().await {
            process_block_range(
                block_range,
                Arc::clone(&contract),
                gas_limit,
                chain_state.clone(),
                metrics.clone(),
                fulfilled_requests_cache.clone(),
            )
            .in_current_span()
            .await;
        }
    }
}

/// Processes the backlog_range for a chain.
#[tracing::instrument(skip_all)]
pub async fn process_backlog(
    backlog_range: BlockRange,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
    chain_state: BlockchainState,
    metrics: Arc<KeeperMetrics>,
    fulfilled_requests_cache: Arc<RwLock<HashMap<u64, RequestState>>>,
) {
    tracing::info!("Processing backlog");
    process_block_range(
        backlog_range,
        contract,
        gas_limit,
        chain_state,
        metrics,
        fulfilled_requests_cache,
    )
    .in_current_span()
    .await;
    tracing::info!("Backlog processed");
}


/// tracks the balance of the given address on the given chain
/// if there was an error, the function will just return
#[tracing::instrument(skip_all)]
pub async fn track_balance(
    chain_id: String,
    chain_config: EthereumConfig,
    address: Address,
    metrics_registry: Arc<KeeperMetrics>,
) {
    let provider = match Provider::<Http>::try_from(&chain_config.geth_rpc_addr) {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Error while connecting to geth rpc. error: {:?}", e);
            return;
        }
    };

    let balance = match provider.get_balance(address, None).await {
        // This conversion to u128 is fine as the total balance will never cross the limits
        // of u128 practically.
        Ok(r) => r.as_u128(),
        Err(e) => {
            tracing::error!("Error while getting balance. error: {:?}", e);
            return;
        }
    };
    // The f64 conversion is made to be able to serve metrics within the constraints of Prometheus.
    // The balance is in wei, so we need to divide by 1e18 to convert it to eth.
    let balance = balance as f64 / 1e18;

    metrics_registry
        .balance
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address:  address.to_string(),
        })
        .set(balance);
}

/// tracks the collected fees and the hashchain data of the given provider address on the given chain
/// if there is a error the function will just return
#[tracing::instrument(skip_all)]
pub async fn track_provider(
    chain_id: String,
    chain_config: EthereumConfig,
    provider_address: Address,
    metrics_registry: Arc<KeeperMetrics>,
) {
    let contract = match PythContract::from_config(&chain_config) {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Error while connecting to pythnet contract. error: {:?}", e);
            return;
        }
    };

    let provider_info = match contract.get_provider_info(provider_address).call().await {
        Ok(info) => info,
        Err(e) => {
            tracing::error!("Error while getting provider info. error: {:?}", e);
            return;
        }
    };

    // The f64 conversion is made to be able to serve metrics with the constraints of Prometheus.
    // The fee is in wei, so we divide by 1e18 to convert it to eth.
    let collected_fee = provider_info.accrued_fees_in_wei as f64 / 1e18;

    let current_sequence_number = provider_info.sequence_number;
    let end_sequence_number = provider_info.end_sequence_number;

    metrics_registry
        .collected_fee
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address:  provider_address.to_string(),
        })
        .set(collected_fee);

    metrics_registry
        .current_sequence_number
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address:  provider_address.to_string(),
        })
        // sequence_number type on chain is u64 but practically it will take
        // a long time for it to cross the limits of i64.
        // currently prometheus only supports i64 for Gauge types
        .set(current_sequence_number as i64);
    metrics_registry
        .end_sequence_number
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address:  provider_address.to_string(),
        })
        .set(end_sequence_number as i64);
}
