use {
    crate::{
        chain::{
            ethereum::SignablePythContract,
            reader::EntropyReader,
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
            Provider,
        },
        signers::LocalWallet,
        types::H160,
    },
    std::sync::Arc,
    tokio::{
        sync::watch,
        time::{
            self,
            Duration,
        },
    },
};

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
                    if event.provider_address == provider_address {
                        let res = contract_reader
                            .get_request(event.provider_address, event.sequence_number)
                            .await;

                        if let Ok(req) = res {
                            match req {
                                Some(req) => {
                                    if req.sequence_number == 0
                                        || req.provider != event.provider_address
                                        || req.sequence_number != event.sequence_number
                                    {
                                        continue;
                                    }
                                }
                                None => continue,
                            }
                        }

                        let provider_revelation = hash_chain_state.reveal(event.sequence_number)?;

                        let sim_res = contract_reader
                            .similate_reveal(
                                provider_address,
                                event.sequence_number,
                                event.user_random_number,
                                provider_revelation,
                            )
                            .await;
                        match sim_res {
                            Ok(_) => {
                                let res = contract
                                    .reveal_with_callback_wrapper(
                                        provider_address,
                                        event.sequence_number,
                                        event.user_random_number,
                                        provider_revelation,
                                        nonce_manager.next(),
                                    )
                                    .await;
                                match res {
                                    Ok(_) => {
                                        tracing::info!("Revealed for provider: {provider_address} and sequence number: {} \n res: {:?}", event.sequence_number, res);
                                    }
                                    Err(e) => {
                                        tracing::error!("Error while revealing for provider: {provider_address} and sequence number: {} \n res: {:?}", event.sequence_number, e);
                                    }
                                }
                            }
                            Err(e) => {
                                tracing::error!("Error while simulating reveal for provider: {provider_address} and sequence number: {} \n res: {:?}", event.sequence_number, e);
                            }
                        }
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
