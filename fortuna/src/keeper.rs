use {
    crate::{
        api,
        chain::{
            ethereum::SignablePythContract,
            reader::{
                BlockNumber,
                EntropyReader,
                RequestedWithCallbackEvent,
            },
        },
        config::EthereumConfig,
        state::HashChainState,
    },
    anyhow::Result,
    ethers::{
        middleware::NonceManagerMiddleware,
        providers::{
            Http,
            Middleware,
            Provider,
            StreamExt,
        },
        types::{
            H160,
            U256,
        },
    },
    std::sync::Arc,
    tokio::{
        sync::mpsc,
        time::{
            self,
            sleep,
            Duration,
        },
    },
    tracing,
};

pub async fn process_event(
    event: RequestedWithCallbackEvent,
    contract_reader: &Arc<dyn EntropyReader>,
    hash_chain_state: &Arc<HashChainState>,
    contract: &Arc<SignablePythContract>,
    nonce_manager: &Arc<NonceManagerMiddleware<Provider<Http>>>,
    gas_limit: U256,
) -> Result<()> {
    let provider_revelation = hash_chain_state.reveal(event.sequence_number)?;

    let sim_res = contract_reader
        .simulate_reveal(
            event.provider_address,
            event.sequence_number,
            event.user_random_number,
            provider_revelation,
        )
        .await;

    match sim_res {
        Ok(_) => {
            let res = contract
                .reveal_with_callback_wrapper(
                    event.provider_address,
                    event.sequence_number,
                    event.user_random_number,
                    provider_revelation,
                    nonce_manager.next(),
                    gas_limit,
                )
                .await;
            match res {
                Ok(_) => {
                    tracing::info!(
                        "Revealed for provider: {} and sequence number: {} with res: {:?}",
                        event.provider_address,
                        event.sequence_number,
                        res
                    );
                }
                Err(e) => {
                    // TODO: find a way to handle different errors.
                    tracing::error!(
                        "Error while revealing for provider: {} and sequence number: {} with error: {:?}",
                        event.provider_address,
                        event.sequence_number,
                        e
                    );
                }
            }
        }
        Err(e) => {
            tracing::error!(
                "Error while simulating reveal for provider: {} and sequence number: {} \n res: {:?}",
                event.provider_address,
                event.sequence_number,
                e
            );
        }
    }
    Ok(())
}

pub async fn handle_backlog(
    chain_id: String,
    provider_address: H160,
    latest_safe_block: u64,
    contract_reader: Arc<dyn EntropyReader>,
    hash_chain_state: Arc<HashChainState>,
    nonce_manager: Arc<NonceManagerMiddleware<Provider<Http>>>,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
) -> Result<()> {
    tracing::info!("Starting backlog handler for chain: {}", &chain_id);
    let backlog_blocks: u64 = 10_000;
    let blocks_at_a_time = 100;

    let mut from_block = if backlog_blocks > latest_safe_block {
        0
    } else {
        latest_safe_block - backlog_blocks
    };
    let last_block = latest_safe_block;

    while from_block < last_block {
        tracing::info!("Waiting for 5 seconds before processing the a lot of blocks");
        time::sleep(Duration::from_secs(5)).await;

        tracing::info!(
            "Processing backlog for chain: {} from block: {} to block: {}",
            &chain_id,
            &from_block,
            &last_block
        );
        let mut to_block = from_block + blocks_at_a_time;
        if to_block > last_block {
            to_block = last_block;
        }

        let events_res = contract_reader
            .get_request_with_callback_events(from_block, to_block)
            .await;

        match events_res {
            Ok(events) => {
                for event in events {
                    if provider_address != event.provider_address {
                        continue;
                    }

                    if let Err(e) = process_event(
                        event,
                        &contract_reader,
                        &hash_chain_state,
                        &contract,
                        &nonce_manager,
                        gas_limit,
                    )
                    .await
                    {
                        // TODO: some retry mechanisms here
                        tracing::error!("Error processing event: {:?}", e);
                    }
                }

                from_block = to_block + 1;

                tracing::info!(
                    "Backlog processed for chain: {} from block: {}",
                    &chain_id,
                    &from_block
                );
            }
            Err(_) => {
                tracing::error!(
                    "Error while getting events for chain: {} from block: {} to block: {}",
                    &chain_id,
                    &from_block,
                    &to_block
                );

                tracing::info!("Waiting for 5 seconds before re-handling the backlog");
                time::sleep(Duration::from_secs(5)).await;

                continue;
            }
        }
    }

    Ok(())
}

pub struct BlockRange {
    pub from: BlockNumber,
    pub to:   BlockNumber,
}

pub async fn watch_blocks(
    chain_id: String,
    chain_eth_config: EthereumConfig,
    contract_reader: Arc<dyn EntropyReader>,
    chain_config: api::BlockchainState,
    latest_safe_block: BlockNumber,
    tx: mpsc::Sender<BlockRange>,
) -> Result<()> {
    tracing::info!(
        "Watching blocks to handle new events for chain: {}",
        &chain_id
    );
    loop {
        // for a http provider it only supports streaming
        let provider = Provider::<Http>::try_from(&chain_eth_config.geth_rpc_addr)?;
        let stream = provider.watch_blocks().await;

        let mut last_safe_block_processed = latest_safe_block;

        match stream {
            Ok(mut stream) => loop {
                tracing::info!("Waiting for next block for chain: {}", &chain_id);
                if let Some(_) = stream.next().await {
                    let latest_confirmed_block_res = contract_reader
                        .get_block_number(chain_config.confirmed_block_status)
                        .await;

                    match latest_confirmed_block_res {
                        Ok(latest_confirmed_block) => {
                            let latest_safe_block =
                                latest_confirmed_block - chain_config.reveal_delay_blocks;

                            if latest_safe_block > last_safe_block_processed {
                                if let Err(_) = tx
                                    .send(BlockRange {
                                        from: last_safe_block_processed + 1,
                                        to:   latest_safe_block,
                                    })
                                    .await
                                {
                                    tracing::error!("Error while sending block range to handle events for chain {chain_id}. These will be handled in next call.");
                                    continue;
                                };

                                tracing::info!(
                                    "Block range sent to handle events for chain {}: {} to {}",
                                    &chain_id,
                                    &last_safe_block_processed + 1,
                                    &latest_safe_block
                                );
                                last_safe_block_processed = latest_safe_block;
                            }
                        }
                        Err(_) => {
                            tracing::error!(
                                "Error while getting latest safe block for chain: {}",
                                &chain_id
                            );
                            continue;
                        }
                    }
                }
            },
            Err(e) => {
                tracing::error!("Error while watching blocks for chain: {}", &chain_id);
                tracing::error!("Error: {:?}", e);
                tracing::error!("Waiting for 5 seconds before re-watching the blocks");
                sleep(tokio::time::Duration::from_secs(5)).await;
                continue;
            }
        }
    }
}

/// Handles events for a specific blockchain chain.
pub async fn handle_events(
    chain_id: String,
    provider_address: H160,
    mut rx: mpsc::Receiver<crate::keeper::BlockRange>,
    contract_reader: Arc<dyn EntropyReader>,
    hash_chain_state: Arc<crate::state::HashChainState>,
    nonce_manager: Arc<NonceManagerMiddleware<Provider<Http>>>,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
) -> Result<()> {
    tracing::info!("Handling events for chain: {}", &chain_id);
    loop {
        tracing::info!(
            "Waiting for block range to handle events for chain: {}",
            &chain_id
        );
        if let Some(block_range) = rx.recv().await {
            tracing::info!(
                "Handling events for chain: {} from block: {} to block: {}",
                &chain_id,
                &block_range.from,
                &block_range.to
            );
            // TODO: add to config
            let blocks_at_a_time = 100;
            let mut from_block = block_range.from;

            while from_block <= block_range.to {
                let mut to_block = from_block + blocks_at_a_time;
                if to_block > block_range.to {
                    to_block = block_range.to;
                }

                tracing::info!(
                    "Processing events for chain: {} from block: {} to block: {}",
                    &chain_id,
                    &from_block,
                    &to_block
                );

                let events_res = contract_reader
                    .get_request_with_callback_events(from_block, to_block)
                    .await;

                match events_res {
                    Ok(events) => {
                        for event in events {
                            if provider_address != event.provider_address {
                                continue;
                            }

                            if let Err(e) = process_event(
                                event,
                                &contract_reader,
                                &hash_chain_state,
                                &contract,
                                &nonce_manager,
                                gas_limit,
                            )
                            .await
                            {
                                // TODO: retry mechanisms
                                tracing::error!("Error processing event: {:?}", e);
                            }
                        }

                        tracing::info!(
                            "Events processed for chain: {} from block: {} to block: {}",
                            &chain_id,
                            &from_block,
                            &to_block
                        );

                        from_block = to_block + 1;
                    }
                    Err(_) => {
                        tracing::error!(
                            "Error while getting events for chain: {} from block: {} to block: {}",
                            &chain_id,
                            &from_block,
                            &to_block
                        );
                        continue;
                    }
                }
            }
        }
    }
}
