use {
    crate::{
        api::{self, BlockchainState},
        chain::{ethereum::InstrumentedSignablePythContract, reader::BlockNumber},
        keeper::keeper_metrics::{AccountLabel, KeeperMetrics},
        keeper::hermes::fetch_price_updates_from_hermes,
    },
    anyhow::Result,
    ethers::types::U256,
    fortuna::eth_utils::utils::{submit_tx_with_backoff, EscalationPolicy},
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
    hermes_base_url: String,
) {
    tracing::info!("Processing active requests from contract storage");

    loop {
        let active_requests_res = chain_state.contract.get_active_requests(max_requests).await;

        match active_requests_res {
            Ok(requests) => {
                tracing::info!(num_of_requests = &requests.len(), "Processing active requests");

                for request in &requests {
                    // The write lock guarantees we spawn only one task per sequence number
                    let newly_inserted = fulfilled_requests_cache
                        .write()
                        .await
                        .insert(request.sequence_number);

                    if newly_inserted {
                        spawn(
                            process_request_with_backoff(
                                request.clone(),
                                chain_state.clone(),
                                contract.clone(),
                                gas_limit,
                                escalation_policy.clone(),
                                metrics.clone(),
                                hermes_base_url.clone(),
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

/// Process a request with backoff. It will retry the callback execution on failure for 5 minutes.
#[tracing::instrument(name = "process_request_with_backoff", skip_all, fields(
    sequence_number = request.sequence_number
))]
pub async fn process_request_with_backoff(
    request: crate::chain::reader::Request,
    chain_state: BlockchainState,
    contract: Arc<InstrumentedSignablePythContract>,
    gas_limit: U256,
    escalation_policy: EscalationPolicy,
    metrics: Arc<KeeperMetrics>,
    hermes_base_url: String,
) -> Result<()> {
    // We process all price update requests for our provider
    let account_label = AccountLabel {
        chain_id: chain_state.id.clone(),
        address: chain_state.provider_address.to_string(),
    };

    metrics.requests.get_or_create(&account_label).inc();
    tracing::info!("Started processing request");

    // Get the request details from the contract to get the publish_time
    let request_details = match chain_state.contract.get_request(request.sequence_number).await? {
        Some(req) => req,
        None => {
            tracing::warn!("Request not found on-chain, it may have been already fulfilled");
            return Ok(());
        }
    };

    // Fetch price update data from Hermes for the requested price IDs
    let update_data = fetch_price_updates_from_hermes(
        request_details.publish_time.as_u64(),
        &request.price_ids,
        hermes_base_url,
    ).await?;

    let contract_call = contract.execute_callback(
        request.sequence_number,
        update_data,
        request.price_ids.clone(),
    );

    let success = submit_tx_with_backoff(
        contract.client(),
        contract_call,
        gas_limit,
        escalation_policy,
    )
    .await;

    metrics
        .requests_processed
        .get_or_create(&account_label)
        .inc();

    match success {
        Ok(res) => {
            tracing::info!("Processed request successfully in {:?}", res.duration);

            metrics
                .requests_processed_success
                .get_or_create(&account_label)
                .inc();

            metrics
                .request_duration_ms
                .get_or_create(&account_label)
                .observe(res.duration.as_millis() as f64);

            // Track retry count, gas multiplier, and fee multiplier for successful transactions
            metrics
                .retry_count
                .get_or_create(&account_label)
                .observe(res.num_retries as f64);

            metrics
                .final_gas_multiplier
                .get_or_create(&account_label)
                .observe(res.gas_multiplier as f64);

            metrics
                .final_fee_multiplier
                .get_or_create(&account_label)
                .observe(res.fee_multiplier as f64);

            if let Ok(receipt) = res.receipt {
                if let Some(gas_used) = receipt.gas_used {
                    let gas_used_float = gas_used.as_u128() as f64 / 1e18;
                    metrics
                        .total_gas_spent
                        .get_or_create(&account_label)
                        .inc_by(gas_used_float);

                    if let Some(gas_price) = receipt.effective_gas_price {
                        let gas_fee = (gas_used * gas_price).as_u128() as f64 / 1e18;
                        metrics
                            .total_gas_fee_spent
                            .get_or_create(&account_label)
                            .inc_by(gas_fee);
                    }
                }
            }
            metrics.callbacks_executed.get_or_create(&account_label).inc();
        }
        Err(e) => {
            // In case the callback did not succeed, we double-check that the request is still on-chain.
            // If the request is no longer on-chain, one of the transactions we sent likely succeeded, but
            // the RPC gave us an error anyway.
            let req = chain_state
                .contract
                .get_request(request.sequence_number)
                .await;

            tracing::error!("Failed to process request: {:?}. Request: {:?}", e, req);

            // We only count failures for cases where we are completely certain that the callback failed.
            if req.is_ok_and(|x| x.is_some()) {
                metrics
                    .requests_processed_failure
                    .get_or_create(&account_label)
                    .inc();
            }
        }
    }

    Ok(())
}
