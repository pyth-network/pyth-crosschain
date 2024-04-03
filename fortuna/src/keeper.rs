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
    tracing,
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
                tracing::error!("Error while getting block number. error: {:?}", e);
                time::sleep(RETRY_INTERVAL).await;
            }
        }
    }
}


pub async fn run_keeper_threads(
    private_key: String,
    chain_eth_config: EthereumConfig,
    chain_state: BlockchainState,
) {
    tracing::info!("Starting keeper for chain: {}", &chain_state.id);

    let latest_safe_block = get_latest_safe_block(&chain_state).await;

    tracing::info!(
        "Latest safe block for chain {}: {} ",
        &chain_state.id,
        &latest_safe_block
    );

    let contract = Arc::new(
        SignablePythContract::from_config(&chain_eth_config, &private_key)
            .await
            .expect("Chain config should be valid"),
    );

    let backlog_chain_state = chain_state.clone();
    let backlog_contract = contract.clone();
    spawn(async move {
        let from_block = latest_safe_block.saturating_sub(BACKLOG_RANGE);
        process_block_range(
            BlockRange {
                from: from_block,
                to:   latest_safe_block,
            },
            backlog_contract,
            chain_eth_config.gas_limit,
            backlog_chain_state.clone(),
        )
        .await;
        tracing::info!(
            "Backlog processing for chain: {} completed",
            &backlog_chain_state.id
        );
    });

    let (tx, rx) = mpsc::channel::<BlockRange>(1000);

    let watch_blocks_chain_state = chain_state.clone();
    spawn(async move {
        loop {
            if let Err(e) = watch_blocks(
                watch_blocks_chain_state.clone(),
                latest_safe_block,
                tx.clone(),
                chain_eth_config.geth_rpc_wss.clone(),
            )
            .await
            {
                tracing::error!(
                    "Error in watching blocks for chain: {}, {:?}",
                    &watch_blocks_chain_state.id,
                    e
                );
                time::sleep(RETRY_INTERVAL).await;
            }
        }
    });
    spawn(process_new_blocks(
        chain_state.clone(),
        rx,
        Arc::clone(&contract),
        chain_eth_config.gas_limit,
    ));
}

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
                "Error while revealing for provider: {} and sequence number: {} with error: {:?}",
                event.provider_address,
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
                        "Gas estimate for reveal with callback is higher than the gas limit for chain: {}",
                        &chain_config.id
                    );
                    return Ok(());
                }

                let res = contract
                    .reveal_with_callback(
                        event.provider_address,
                        event.sequence_number,
                        event.user_random_number,
                        provider_revelation,
                    )
                    .gas(gas_estimate)
                    .send()
                    .await?
                    .await;

                match res {
                    Ok(_) => {
                        tracing::info!(
                            "Revealed on chain: {} for provider: {} and sequence number: {} with res: {:?}",
                            &chain_config.id,
                            event.provider_address,
                            event.sequence_number,
                            res
                        );
                        Ok(())
                    }
                    Err(e) => {
                        tracing::error!(
                            "Error while revealing for provider: {} and sequence number: {} with error: {:?}",
                            event.provider_address,
                            event.sequence_number,
                            e
                        );
                        Err(e.into())
                    }
                }
            }
            None => Ok(()),
        },
        Err(e) => {
            tracing::error!(
                "Error while simulating reveal for provider: {} and sequence number: {} \n error: {:?}",
                event.provider_address,
                event.sequence_number,
                e
            );
            Err(e)
        }
    }
}


/// Process a range of blocks for a chain. Retry internally if there is an error.
pub async fn process_block_range(
    block_range: BlockRange,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
    chain_state: api::BlockchainState,
) {
    tracing::info!(
        "Processing blocks for chain: {} from block: {} to block: {}",
        &chain_state.id,
        block_range.from,
        block_range.to
    );

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
                for event in events {
                    while let Err(e) =
                        process_event(event.clone(), &chain_state, &contract, gas_limit).await
                    {
                        tracing::error!(
                            "Error while processing event for chain: {} and sequence number: {}. Waiting for {} seconds before retry. error: {:?}",
                            &chain_state.id,
                            &event.sequence_number,
                            RETRY_INTERVAL.as_secs(),
                            e
                        );
                        time::sleep(RETRY_INTERVAL).await;
                    }
                }
                tracing::info!(
                    "Backlog processed for chain: {} from block: {} to block: {}",
                    &chain_state.id,
                    &current_block,
                    &to_block
                );
                current_block = to_block + 1;
            }
            Err(e) => {
                tracing::error!(
                    "Error while getting events for chain: {} from block: {} to block: {}. Waiting for {} seconds before retry.  error: {:?}",
                    &chain_state.id,
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

pub struct BlockRange {
    pub from: BlockNumber,
    pub to:   BlockNumber,
}

pub async fn watch_blocks(
    chain_state: BlockchainState,
    latest_safe_block: BlockNumber,
    tx: mpsc::Sender<BlockRange>,
    geth_rpc_wss: Option<String>,
) -> Result<()> {
    tracing::info!(
        "Watching blocks to handle new events for chain: {}",
        &chain_state.id
    );
    let mut last_safe_block_processed = latest_safe_block;

    let provider_option = match geth_rpc_wss {
        Some(wss) => Some(Provider::<Ws>::connect(wss).await?),
        None => {
            tracing::info!("No wss provided for chain: {}", &chain_state.id);
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

        let latest_safe_block = get_latest_safe_block(&chain_state).await;
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
                        "Block range sent to handle events for chain {}: {} to {}",
                        &chain_state.id,
                        &last_safe_block_processed + 1,
                        &latest_safe_block
                    );
                    last_safe_block_processed = latest_safe_block;
                }
                Err(e) => {
                    tracing::error!("Error while sending block range to handle events for chain {}. These will be handled in next call. error: {:?}",&chain_state.id,e);
                }
            };
        }
    }
}

/// Handles events for a specific blockchain chain.
pub async fn process_new_blocks(
    chain_state: BlockchainState,
    mut rx: mpsc::Receiver<BlockRange>,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
) {
    loop {
        tracing::info!(
            "Waiting for new block ranges to process for chain: {}",
            &chain_state.id
        );
        if let Some(block_range) = rx.recv().await {
            process_block_range(
                block_range,
                Arc::clone(&contract),
                gas_limit,
                chain_state.clone(),
            )
            .await;
        }
    }
}
