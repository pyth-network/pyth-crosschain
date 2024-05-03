use {
    crate::{
        api::{
            self,
            BlockchainState,
        },
        chain::{
            ethereum::SignablePythContract,
            reader::{
                BlockNumber,
                RequestedWithCallbackEvent,
            },
        },
        config::EthereumConfig,
    },
    anyhow::Result,
    ethers::{
        contract::ContractError,
        providers::{
            Middleware,
            Provider,
            Ws,
        },
        types::U256,
    },
    futures::StreamExt,
    std::sync::Arc,
    tokio::{
        spawn,
        sync::mpsc,
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
const POLL_INTERVAL: Duration = Duration::from_secs(5);


/// Get the latest safe block number for the chain. Retry internally if there is an error.
async fn get_latest_safe_block(chain_state: &BlockchainState) -> BlockNumber {
    loop {
        match chain_state
            .contract
            .get_block_number(chain_state.confirmed_block_status)
            .await
        {
            Ok(latest_confirmed_block) => {
                return latest_confirmed_block - chain_state.reveal_delay_blocks
            }
            Err(e) => {
                tracing::error!("error while getting block number. error: {:?}", e);
                time::sleep(RETRY_INTERVAL).await;
            }
        }
    }
}

/// Run threads to handle events for the last `BACKLOG_RANGE` blocks. Watch for new blocks and
/// handle any events for the new blocks.
// `tracing::instrument` creates a new span for the method `run_keeper_threads`.
// The span is created with the name "keeper" and the field "chain_id" is set to the chain_state.id.
#[tracing::instrument(name="keeper", skip_all, fields(chain_id=chain_state.id))]
pub async fn run_keeper_threads(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
) {
    tracing::info!("starting keeper");
    let latest_safe_block = get_latest_safe_block(&chain_state).in_current_span().await;
    tracing::info!("latest safe block: {}", &latest_safe_block);

    let contract = Arc::new(
        SignablePythContract::from_config(&chain_eth_config, &private_key)
            .await
            .expect("Chain config should be valid"),
    );

    // Spawn a thread to handle the events from last BACKLOG_RANGE blocks.
    spawn(
        process_backlog(
            BlockRange {
                from: latest_safe_block.saturating_sub(BACKLOG_RANGE),
                to:   latest_safe_block,
            },
            contract.clone(),
            chain_eth_config.gas_limit,
            chain_state.clone(),
        )
        .in_current_span(),
    );

    let (tx, rx) = mpsc::channel::<BlockRange>(1000);

    // Spawn a thread to watch for new blocks and send the range of blocks for which events has not been handled to the `tx` channel.
    spawn(
        watch_blocks_loop(
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
            chain_eth_config.gas_limit,
        )
        .in_current_span(),
    );
}


// Process an event for a chain. It estimates the gas for the reveal with callback and
// submits the transaction if the gas estimate is below the gas limit.
// It will return an Error if the gas estimation failed with a provider error or if the
// reveal with callback failed with a provider error.
pub async fn process_event(
    event: RequestedWithCallbackEvent,
    chain_config: &BlockchainState,
    contract: &Arc<SignablePythContract>,
    gas_limit: U256,
) -> Result<()> {
    if chain_config.provider_address != event.provider_address {
        return Ok(());
    }
    let provider_revelation = match chain_config.state.reveal(event.sequence_number) {
        Ok(result) => result,
        Err(e) => {
            tracing::error!(
                "Error while revealing for sequence number: {} with error: {:?}",
                event.sequence_number,
                e
            );
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
                        "Gas estimate for reveal with callback is higher than the gas limit for sequence number: {}",
                        event.sequence_number
                    );
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
                            tracing::error!(
                                "Error while revealing for sequence number: {} with error: {:?}",
                                event.sequence_number,
                                e
                            );
                            return Ok(());
                        }
                    },
                };

                match pending_tx.await {
                    Ok(res) => {
                        tracing::info!(
                            "Revealed for sequence number: {} with res: {:?}",
                            event.sequence_number,
                            res
                        );
                        Ok(())
                    }
                    Err(e) => {
                        tracing::error!(
                            "Error while revealing for sequence number: {} with error: {:?}",
                            event.sequence_number,
                            e
                        );
                        Err(e.into())
                    }
                }
            }
            None => {
                tracing::info!(
                    "Not processing event for sequence number: {}",
                    event.sequence_number
                );
                Ok(())
            }
        },
        Err(e) => {
            tracing::error!(
                "Error while simulating reveal for sequence number: {} \n error: {:?}",
                event.sequence_number,
                e
            );
            Err(e)
        }
    }
}


/// Process a range of blocks for a chain. It will fetch events for the blocks in the provided range
/// and then try to process them one by one. If the process fails, it will retry indefinitely.
//
// `tracing::instrument` creates a new span for the method `process_block_range`.
// The span is created with the name same as the method name and with no fields.
#[tracing::instrument(skip_all, fields(range_from_block=block_range.from, range_to_block=block_range.to))]
pub async fn process_block_range(
    block_range: BlockRange,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
    chain_state: api::BlockchainState,
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
        let events_res = chain_state
            .contract
            .get_request_with_callback_events(current_block, to_block)
            .await;

        match events_res {
            Ok(events) => {
                tracing::info!(
                    "Processing {} events from block: {} to block: {}",
                    &events.len(),
                    &current_block,
                    &to_block
                );
                for event in &events {
                    tracing::info!(
                        "Processing event for sequence number: {}",
                        &event.sequence_number
                    );
                    while let Err(e) =
                        process_event(event.clone(), &chain_state, &contract, gas_limit)
                            .in_current_span()
                            .await
                    {
                        tracing::error!(
                            "Error while processing event for sequence number: {}. Waiting for {} seconds before retry. error: {:?}",
                            &event.sequence_number,
                            RETRY_INTERVAL.as_secs(),
                            e
                        );
                        time::sleep(RETRY_INTERVAL).await;
                    }
                    tracing::info!(
                        "Processed event for sequence number: {}",
                        &event.sequence_number
                    );
                }
                tracing::info!(
                    "Processed {} events from block: {} to block: {}",
                    &events.len(),
                    &current_block,
                    &to_block
                );
                current_block = to_block + 1;
            }
            Err(e) => {
                tracing::error!(
                    "Error while getting events from block: {} to block: {}. Waiting for {} seconds before retry.  error: {:?}",
                    &current_block,
                    &to_block,
                    RETRY_INTERVAL.as_secs(),
                    e
                );
                time::sleep(RETRY_INTERVAL).await;
            }
        }
    }
}

#[derive(Debug)]
pub struct BlockRange {
    pub from: BlockNumber,
    pub to:   BlockNumber,
}

#[tracing::instrument(name="watch_blocks", skip_all, fields(initial_safe_block=latest_safe_block))]
pub async fn watch_blocks_loop(
    chain_state: BlockchainState,
    latest_safe_block: BlockNumber,
    tx: mpsc::Sender<BlockRange>,
    geth_rpc_wss: Option<String>,
) {
    loop {
        if let Err(e) = watch_blocks(
            chain_state.clone(),
            latest_safe_block,
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
    latest_safe_block: BlockNumber,
    tx: mpsc::Sender<BlockRange>,
    geth_rpc_wss: Option<String>,
) -> Result<()> {
    tracing::info!("Watching blocks to handle new events");
    let mut last_safe_block_processed = latest_safe_block;

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
        Some(ref provider) => Some(provider.subscribe_blocks().await?),
        None => None,
    };

    loop {
        match stream_option {
            Some(ref mut stream) => {
                stream.next().await;
            }
            None => {
                time::sleep(POLL_INTERVAL).await;
            }
        }

        let latest_safe_block = get_latest_safe_block(&chain_state).in_current_span().await;
        if latest_safe_block > last_safe_block_processed {
            match tx
                .send(BlockRange {
                    from: last_safe_block_processed + 1,
                    to:   latest_safe_block,
                })
                .await
            {
                Ok(_) => {
                    tracing::info!(
                        "Block range sent to handle events from: {} to: {}",
                        &last_safe_block_processed + 1,
                        &latest_safe_block
                    );
                    last_safe_block_processed = latest_safe_block;
                }
                Err(e) => {
                    tracing::error!(
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
) {
    tracing::info!("Waiting for new block ranges to process");
    loop {
        if let Some(block_range) = rx.recv().await {
            process_block_range(
                block_range,
                Arc::clone(&contract),
                gas_limit,
                chain_state.clone(),
            )
            .in_current_span()
            .await;
        }
    }
}

#[tracing::instrument(skip_all)]
pub async fn process_backlog(
    backlog_range: BlockRange,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
    chain_state: BlockchainState,
) {
    tracing::info!("Processing backlog");
    process_block_range(backlog_range, contract, gas_limit, chain_state)
        // This is important! process_block_range is being called in the context of the "process_backlog" span.
        // We need to add in_current_span to a future otherwise the span might won't work as expected.
        .in_current_span()
        .await;
    tracing::info!("Backlog processed");
}
