use {
    crate::{
        api::{self, BlockchainState},
        chain::{ethereum::InstrumentedSignablePythContract, reader::BlockNumber},
        keeper::keeper_metrics::KeeperMetrics,
        keeper::process_event::process_event_with_backoff,
    },
    anyhow::{anyhow, Result},
    ethers::{
        providers::{Middleware, Provider, Ws},
        types::U256,
    },
    fortuna::eth_utils::utils::EscalationPolicy,
    futures::StreamExt,
    std::{collections::HashSet, sync::Arc},
    tokio::{
        spawn,
        sync::{mpsc, RwLock},
        time::{self, Duration},
    },
    tracing::{self, Instrument},
};

/// How much to wait before retrying in case of an RPC error
const RETRY_INTERVAL: Duration = Duration::from_secs(5);
/// How many blocks to fetch events for in a single rpc call
const BLOCK_BATCH_SIZE: u64 = 100;
/// How much to wait before polling the next latest block
const POLL_INTERVAL: Duration = Duration::from_secs(2);
/// Retry last N blocks
const RETRY_PREVIOUS_BLOCKS: u64 = 100;

#[derive(Debug, Clone)]
pub struct BlockRange {
    pub from: BlockNumber,
    pub to: BlockNumber,
}

/// Get the latest safe block number for the chain. Retry internally if there is an error.
pub async fn get_latest_safe_block(chain_state: &BlockchainState) -> BlockNumber {
    loop {
        match chain_state
            .contract
            .get_block_number(chain_state.confirmed_block_status)
            .await
        {
            Ok(latest_confirmed_block) => {
                tracing::info!("Fetched latest safe block {}", latest_confirmed_block);
                return latest_confirmed_block;
            }
            Err(e) => {
                tracing::error!("Error while getting block number. error: {:?}", e);
                time::sleep(RETRY_INTERVAL).await;
            }
        }
    }
}

/// Process a range of blocks in batches. It calls the `process_single_block_batch` method for each batch.
#[tracing::instrument(skip_all, fields(
    range_from_block = block_range.from, range_to_block = block_range.to
))]
pub async fn process_block_range(
    block_range: BlockRange,
    contract: Arc<InstrumentedSignablePythContract>,
    gas_limit: U256,
    escalation_policy: EscalationPolicy,
    chain_state: api::BlockchainState,
    metrics: Arc<KeeperMetrics>,
    fulfilled_requests_cache: Arc<RwLock<HashSet<u64>>>,
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
                to: to_block,
            },
            contract.clone(),
            gas_limit,
            escalation_policy.clone(),
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
#[tracing::instrument(name = "batch", skip_all, fields(
    batch_from_block = block_range.from, batch_to_block = block_range.to
))]
pub async fn process_single_block_batch(
    block_range: BlockRange,
    contract: Arc<InstrumentedSignablePythContract>,
    gas_limit: U256,
    escalation_policy: EscalationPolicy,
    chain_state: api::BlockchainState,
    metrics: Arc<KeeperMetrics>,
    fulfilled_requests_cache: Arc<RwLock<HashSet<u64>>>,
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
                    // the write lock guarantees we spawn only one task per sequence number
                    let newly_inserted = fulfilled_requests_cache
                        .write()
                        .await
                        .insert(event.sequence_number);
                    if newly_inserted {
                        spawn(
                            process_event_with_backoff(
                                event.clone(),
                                chain_state.clone(),
                                contract.clone(),
                                gas_limit,
                                escalation_policy.clone(),
                                metrics.clone(),
                            )
                            .in_current_span(),
                        );
                    }
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
#[tracing::instrument(name = "watch_blocks", skip_all, fields(
    initial_safe_block = latest_safe_block
))]
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
                if stream.next().await.is_none() {
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
            let mut from = latest_safe_block.saturating_sub(RETRY_PREVIOUS_BLOCKS);

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

/// It waits on rx channel to receive block ranges and then calls process_block_range to process them
/// for each configured block delay.
#[tracing::instrument(skip_all)]
#[allow(clippy::too_many_arguments)]
pub async fn process_new_blocks(
    chain_state: BlockchainState,
    mut rx: mpsc::Receiver<BlockRange>,
    contract: Arc<InstrumentedSignablePythContract>,
    gas_limit: U256,
    escalation_policy: EscalationPolicy,
    metrics: Arc<KeeperMetrics>,
    fulfilled_requests_cache: Arc<RwLock<HashSet<u64>>>,
    block_delays: Vec<u64>,
) {
    tracing::info!("Waiting for new block ranges to process");
    loop {
        if let Some(block_range) = rx.recv().await {
            // Process blocks immediately first
            process_block_range(
                block_range.clone(),
                Arc::clone(&contract),
                gas_limit,
                escalation_policy.clone(),
                chain_state.clone(),
                metrics.clone(),
                fulfilled_requests_cache.clone(),
            )
            .in_current_span()
            .await;

            // Then process with each configured delay
            for delay in &block_delays {
                let adjusted_range = BlockRange {
                    from: block_range.from.saturating_sub(*delay),
                    to: block_range.to.saturating_sub(*delay),
                };
                process_block_range(
                    adjusted_range,
                    Arc::clone(&contract),
                    gas_limit,
                    escalation_policy.clone(),
                    chain_state.clone(),
                    metrics.clone(),
                    fulfilled_requests_cache.clone(),
                )
                .in_current_span()
                .await;
            }
        }
    }
}

/// Processes the backlog_range for a chain.
#[tracing::instrument(skip_all)]
pub async fn process_backlog(
    backlog_range: BlockRange,
    contract: Arc<InstrumentedSignablePythContract>,
    gas_limit: U256,
    escalation_policy: EscalationPolicy,
    chain_state: BlockchainState,
    metrics: Arc<KeeperMetrics>,
    fulfilled_requests_cache: Arc<RwLock<HashSet<u64>>>,
) {
    tracing::info!("Processing backlog");
    process_block_range(
        backlog_range,
        contract,
        gas_limit,
        escalation_policy,
        chain_state,
        metrics,
        fulfilled_requests_cache,
    )
    .in_current_span()
    .await;
    tracing::info!("Backlog processed");
}
