use {
    crate::{
        api,
        chain::{
            ethereum::{
                PythContract,
                SignablePythContract,
            },
            reader::{
                BlockNumber,
                EntropyReader,
                RequestedWithCallbackEvent,
            },
        },
        config::{
            Config,
            EthereumConfig,
        },
        state::HashChainState,
    },
    anyhow::{
        Error,
        Result,
    },
    ethers::{
        middleware::NonceManagerMiddleware,
        providers::{
            Http,
            Middleware,
            Provider,
            StreamExt,
        },
        types::H160,
    },
    std::sync::Arc,
    tokio::{
        spawn,
        sync::{
            mpsc,
            watch,
        },
        time::{
            self,
            sleep,
            Duration,
        },
    },
};

async fn is_valid_request(
    event: &RequestedWithCallbackEvent,
    contract_reader: &Arc<dyn EntropyReader>,
) -> bool {
    let res = contract_reader
        .get_request(event.provider_address, event.sequence_number)
        .await;

    match res {
        Ok(req) => match req {
            Some(req) => {
                if req.sequence_number == 0
                    || req.provider != event.provider_address
                    || req.sequence_number != event.sequence_number
                {
                    false
                } else {
                    true
                }
            }
            None => false,
        },

        // When there is an error getting the request, we are not sure whether it is a
        // valid request or not. We are considering the request to be valid in such cases.
        // This should happen rarely.
        Err(_) => true,
    }
}

pub async fn process_event(
    event: RequestedWithCallbackEvent,
    contract_reader: &Arc<dyn EntropyReader>,
    hash_chain_state: &Arc<HashChainState>,
    contract: &Arc<SignablePythContract>,
    nonce_manager: &Arc<NonceManagerMiddleware<Provider<Http>>>,
) -> Result<()> {
    if !is_valid_request(&event, &contract_reader).await {
        return Ok(());
    }

    let provider_revelation = hash_chain_state.reveal(event.sequence_number)?;

    let sim_res = contract_reader
        .similate_reveal(
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
                )
                .await;
            match res {
                Ok(_) => {
                    tracing::info!(
                        "Revealed for provider: {} and sequence number: {} \n res: {:?}",
                        event.provider_address,
                        event.sequence_number,
                        res
                    );
                }
                Err(e) => {
                    // TODO: find a way to handle different errors.
                    tracing::error!(
                        "Error while revealing for provider: {} and sequence number: {} \n res: {:?}",
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
    rx_exit_handle_backlog: watch::Receiver<bool>,
) -> Result<()> {
    tracing::info!("Starting backlog handler for chain: {}", &chain_id);
    while !*rx_exit_handle_backlog.borrow() {
        let res = async {
            let backlog_blocks: u64 = 10_000;
            let blocks_at_a_time = 100;

            let mut from_block = if backlog_blocks > latest_safe_block {
                0
            } else {
                latest_safe_block - backlog_blocks
            };
            let last_block = latest_safe_block;

            while !*rx_exit_handle_backlog.borrow() && from_block < last_block {
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

                let events = contract_reader
                    .get_request_with_callback_events(from_block, to_block)
                    .await?;

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
                    )
                    .await
                    {
                        tracing::error!("Error processing event: {:?}", e);
                    }
                }

                tokio::time::sleep(Duration::from_secs(1)).await;
                from_block = to_block + 1;

                tracing::info!(
                    "Backlog processed for chain: {} from block: {}",
                    &chain_id,
                    &from_block
                );

                tracing::info!("Waiting for 5 seconds before processing the next lot of blocks");
                time::sleep(Duration::from_secs(5)).await;
            }

            Ok::<(), Error>(())
        };

        if let Err(e) = res.await {
            tracing::error!("Error while handling backlog: {:?}", e);
            tracing::info!("Waiting for 5 seconds before re-handling the backlog");
            time::sleep(Duration::from_secs(5)).await;
        } else {
            tracing::info!("Backlog processed successfully");
            break;
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
    rx_exit: watch::Receiver<bool>,
) -> Result<()> {
    tracing::info!(
        "Watching blocks to handle new events for chain: {}",
        &chain_id
    );
    while !*rx_exit.borrow() {
        let res = async {
            let mut last_safe_block_processed = latest_safe_block;

            // for a http provider it only supports streaming
            let provider = Provider::<Http>::try_from(&chain_eth_config.geth_rpc_addr)?;
            let mut stream = provider.watch_blocks().await?;

            while !*rx_exit.borrow() {
                tracing::info!("Waiting for next block for chain: {}", &chain_id);
                if let Some(_) = stream.next().await {
                    let latest_safe_block = contract_reader
                        .get_block_number(chain_config.confirmed_block_status)
                        .await?
                        - chain_config.reveal_delay_blocks;

                    tracing::info!(
                        "Last safe block processed for chain {}: {} ",
                        &chain_id,
                        &last_safe_block_processed
                    );
                    tracing::info!(
                        "Latest safe block for chain {}: {} ",
                        &chain_id,
                        &latest_safe_block
                    );

                    if latest_safe_block > last_safe_block_processed {
                        if let Err(_) = tx
                            .send(BlockRange {
                                from: last_safe_block_processed + 1,
                                to:   latest_safe_block,
                            })
                            .await
                        {
                            tracing::error!("Error while sending block range to handle events. These will be handled in next call.");
                            continue;
                        };

                        last_safe_block_processed = latest_safe_block;
                    }
                }
            }

            Ok::<(), Error>(())
        };

        if let Err(e) = res.await {
            tracing::error!("Error in watch_blocks: {:?}", e);
        }

        tracing::error!("Waiting for 5 seconds before re-watching the blocks");
        sleep(tokio::time::Duration::from_secs(5)).await;
    }

    Ok(())
}
