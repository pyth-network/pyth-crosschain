use {
    super::keeper_metrics::{AccountLabel, KeeperMetrics},
    crate::{
        api::BlockchainState,
        chain::{ethereum::InstrumentedSignablePythContract, reader::RequestedWithCallbackEvent},
    },
    anyhow::Result,
    ethers::types::{Bytes, U256},
    fortuna::eth_utils::utils::{submit_tx_with_backoff, EscalationPolicy},
    std::sync::Arc,
    tracing,
};

/// Process an event with backoff. It will retry the callback execution on failure for 5 minutes.
#[tracing::instrument(name = "process_event_with_backoff", skip_all, fields(
    sequence_number = event.sequence_number
))]
pub async fn process_event_with_backoff(
    event: RequestedWithCallbackEvent,
    chain_state: BlockchainState,
    contract: Arc<InstrumentedSignablePythContract>,
    gas_limit: U256,
    escalation_policy: EscalationPolicy,
    metrics: Arc<KeeperMetrics>,
) -> Result<()> {
    // We process all price update requests for our provider
    let account_label = AccountLabel {
        chain_id: chain_state.id.clone(),
        address: chain_state.provider_address.to_string(),
    };

    metrics.requests.get_or_create(&account_label).inc();
    tracing::info!("Started processing event");

    // Fetch price update data for the requested price IDs
    // In a real implementation, this would fetch the actual price data from a source
    // For now, we'll use empty update data as a placeholder
    let update_data: Vec<Bytes> = vec![]; // This would be replaced with actual price data

    let contract_call = contract.execute_callback(
        event.sequence_number,
        update_data,
        event.price_ids.clone(),
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
            tracing::info!("Processed event successfully in {:?}", res.duration);

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
                .get_request(event.sequence_number)
                .await;

            tracing::error!("Failed to process event: {:?}. Request: {:?}", e, req);

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
