use {
    crate::{
        api::BlockchainState,
        chain::{ethereum::InstrumentedSignablePythContract, reader::BlockNumber},
        eth_utils::utils::EscalationPolicy,
        history::History,
        keeper::{
            keeper_metrics::{ChainIdLabel, KeeperMetrics},
            process_event::process_event_with_backoff,
        },
    },
    anyhow::Result,
    ethers::types::U256,
    std::{
        collections::HashSet,
        sync::Arc,
        time::{SystemTime, UNIX_EPOCH},
    },
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

#[derive(Clone)]
pub struct ProcessParams {
    pub contract: Arc<InstrumentedSignablePythContract>,
    pub gas_limit: U256,
    pub escalation_policy: EscalationPolicy,
    pub chain_state: BlockchainState,
    pub metrics: Arc<KeeperMetrics>,
    pub history: Arc<History>,
    pub fulfilled_requests_cache: Arc<RwLock<HashSet<u64>>>,
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

/// Process a range of blocks in batches. It calls the `process_single_block_batch` method for each batch.
#[tracing::instrument(skip_all, fields(
    range_from_block = block_range.from, range_to_block = block_range.to
))]
pub async fn process_block_range(block_range: BlockRange, process_params: ProcessParams) {
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
            process_params.clone(),
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

pub async fn process_single_block_batch(block_range: BlockRange, process_params: ProcessParams) {
    let label = ChainIdLabel {
        chain_id: process_params.chain_state.id.clone(),
    };
    loop {
        let events_res = process_params
            .chain_state
            .contract
            .get_request_with_callback_events(
                block_range.from,
                block_range.to,
                process_params.chain_state.provider_address,
            )
            .await;

        // Only update metrics if we successfully retrieved events.
        if events_res.is_ok() {
            // Track the last time blocks were processed. If anything happens to the processing thread, the
            // timestamp will lag, which will trigger an alert.
            let server_timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_secs() as i64)
                .unwrap_or(0);
            process_params
                .metrics
                .process_event_timestamp
                .get_or_create(&label)
                .set(server_timestamp);

            let current_block = process_params
                .metrics
                .process_event_block_number
                .get_or_create(&label)
                .get();
            if block_range.to > current_block as u64 {
                process_params
                    .metrics
                    .process_event_block_number
                    .get_or_create(&label)
                    .set(block_range.to as i64);
            }
        }

        match events_res {
            Ok(events) => {
                tracing::info!(num_of_events = &events.len(), "Processing",);
                for event in &events {
                    // the write lock guarantees we spawn only one task per sequence number
                    let newly_inserted = process_params
                        .fulfilled_requests_cache
                        .write()
                        .await
                        .insert(event.sequence_number);
                    if newly_inserted {
                        spawn(
                            process_event_with_backoff(event.clone(), process_params.clone())
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
) {
    let mut last_safe_block_processed = latest_safe_block;
    loop {
        if let Err(e) = watch_blocks(
            chain_state.clone(),
            &mut last_safe_block_processed,
            tx.clone(),
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
) -> Result<()> {
    tracing::info!("Watching blocks to handle new events");

    loop {
        time::sleep(POLL_INTERVAL).await;

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
pub async fn process_new_blocks(
    process_params: ProcessParams,
    mut rx: mpsc::Receiver<BlockRange>,
    block_delays: Vec<u64>,
) {
    tracing::info!("Waiting for new block ranges to process");
    loop {
        if let Some(block_range) = rx.recv().await {
            // Process blocks immediately first
            process_block_range(block_range.clone(), process_params.clone())
                .in_current_span()
                .await;

            // Then process with each configured delay
            for delay in &block_delays {
                let adjusted_range = BlockRange {
                    from: block_range.from.saturating_sub(*delay),
                    to: block_range.to.saturating_sub(*delay),
                };
                process_block_range(adjusted_range, process_params.clone())
                    .in_current_span()
                    .await;
            }
        }
    }
}

/// Processes the backlog_range for a chain.
/// It processes the backlog range for each configured block delay.
#[tracing::instrument(skip_all)]
pub async fn process_backlog(
    process_params: ProcessParams,
    backlog_range: BlockRange,
    block_delays: Vec<u64>,
) {
    tracing::info!("Processing backlog");
    // Process blocks immediately first
    process_block_range(backlog_range.clone(), process_params.clone())
        .in_current_span()
        .await;

    // Then process with each configured delay
    for delay in &block_delays {
        let adjusted_range = BlockRange {
            from: backlog_range.from.saturating_sub(*delay),
            to: backlog_range.to.saturating_sub(*delay),
        };
        process_block_range(adjusted_range, process_params.clone())
            .in_current_span()
            .await;
    }
    tracing::info!("Backlog processed");
}
