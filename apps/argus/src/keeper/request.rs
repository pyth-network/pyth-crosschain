use {
    crate::{
        api::{self, BlockchainState},
        chain::{ethereum::InstrumentedSignablePythContract, reader::{BlockNumber, RequestedWithCallbackEvent}},
        keeper::keeper_metrics::KeeperMetrics,
        keeper::process_event::process_event_with_backoff,
    },
    ethers::types::U256,
    fortuna::eth_utils::utils::EscalationPolicy,
    std::{collections::HashSet, sync::Arc},
    tokio::{
        spawn,
        sync::RwLock,
        time::{self, Duration},
    },
    tracing::{self, Instrument},
};

/// How much to wait before retrying in case of an RPC error
const RETRY_INTERVAL: Duration = Duration::from_secs(5);

/// Get the latest safe block number for the chain. Retry internally if there is an error.
/// This is still needed for logging and initialization purposes.
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

/// Process active requests fetched directly from contract storage
#[tracing::instrument(name = "process_active_requests", skip_all)]
pub async fn process_active_requests(
    max_requests: usize,
    contract: Arc<InstrumentedSignablePythContract>,
    gas_limit: U256,
    escalation_policy: EscalationPolicy,
    chain_state: api::BlockchainState,
    metrics: Arc<KeeperMetrics>,
    fulfilled_requests_cache: Arc<RwLock<HashSet<u64>>>,
) {
    tracing::info!("Processing active requests from contract storage");

    loop {
        let active_requests_res = chain_state.contract.get_active_requests(max_requests).await;

        match active_requests_res {
            Ok(requests) => {
                tracing::info!(num_of_requests = &requests.len(), "Processing active requests");

                for request in &requests {
                    // Convert Request to RequestedWithCallbackEvent format for compatibility
                    let event = RequestedWithCallbackEvent {
                        sequence_number: request.sequence_number,
                        requester: request.requester,
                        price_ids: request.price_ids.clone(),
                        callback_gas_limit: request.callback_gas_limit,
                    };

                    // The write lock guarantees we spawn only one task per sequence number
                    let newly_inserted = fulfilled_requests_cache
                        .write()
                        .await
                        .insert(event.sequence_number);

                    if newly_inserted {
                        spawn(
                            process_event_with_backoff(
                                event,
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

                tracing::info!(num_of_requests = &requests.len(), "Processed active requests");
                break;
            }
            Err(e) => {
                tracing::error!(
                    "Error while getting active requests. Waiting for {} seconds before retry. error: {:?}",
                    RETRY_INTERVAL.as_secs(),
                    e
                );
                time::sleep(RETRY_INTERVAL).await;
            }
        }
    }
}
