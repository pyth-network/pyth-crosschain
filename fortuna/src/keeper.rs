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
    },
    anyhow::Result,
    ethers::{
        providers::{
            Http,
            Provider,
        },
        types::U256,
    },
    std::sync::Arc,
    tokio::{
        sync::mpsc,
        time::{
            self,
            Duration,
        },
    },
    tracing,
};

pub async fn process_event(
    event: RequestedWithCallbackEvent,
    chain_config: &api::BlockchainState,
    contract: &Arc<SignablePythContract>,
    gas_limit: U256,
) -> Result<()> {
    let provider_revelation = chain_config.state.reveal(event.sequence_number)?;

    let sim_res = chain_config
        .contract
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
                .reveal_with_callback(
                    event.provider_address,
                    event.sequence_number,
                    event.user_random_number,
                    provider_revelation,
                )
                .gas(gas_limit)
                .send()
                .await?
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
                "Error while simulating reveal for provider: {} and sequence number: {} \n error: {:?}",
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
    latest_safe_block: u64,
    contract: Arc<SignablePythContract>,
    gas_limit: U256,
    chain_config: api::BlockchainState,
) -> Result<()> {
    tracing::info!("Starting backlog handler for chain: {}", &chain_id);
    let backlog_blocks: u64 = 1000;
    let blocks_at_a_time = 100;


    let mut from_block = latest_safe_block.saturating_sub(backlog_blocks);
    let last_block = latest_safe_block;

    while from_block <= last_block {
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

        let events_res = chain_config
            .contract
            .get_request_with_callback_events(from_block, to_block)
            .await;

        match events_res {
            Ok(events) => {
                for event in events {
                    if chain_config.provider_address != event.provider_address {
                        continue;
                    }

                    if let Err(e) = process_event(event, &chain_config, &contract, gas_limit).await
                    {
                        // TODO: some retry mechanisms here
                        tracing::error!("Error processing event: {:?}", e);
                    }
                }

                from_block = to_block + 1;

                tracing::info!(
                    "Backlog processed for chain: {} from block: {} to block: {}",
                    &chain_id,
                    &from_block,
                    &to_block
                );
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
    // get the new blocks mined every 5 seconds and send the new block range to process events.
    loop {
        let mut last_safe_block_processed = latest_safe_block;
        loop {
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
                Err(e) => {
                    tracing::error!(
                        "Error while getting latest safe block for chain: {} error: {:?}",
                        &chain_id,
                        e
                    );
                    continue;
                }
            }

            time::sleep(Duration::from_secs(5)).await;
        }
    }
}

/// Handles events for a specific blockchain chain.
pub async fn handle_events(
    chain_id: String,
    chain_config: api::BlockchainState,
    mut rx: mpsc::Receiver<crate::keeper::BlockRange>,
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

                let events_res = chain_config
                    .contract
                    .get_request_with_callback_events(from_block, to_block)
                    .await;

                match events_res {
                    Ok(events) => {
                        for event in events {
                            if chain_config.provider_address != event.provider_address {
                                continue;
                            }

                            if let Err(e) =
                                process_event(event, &chain_config, &contract, gas_limit).await
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
