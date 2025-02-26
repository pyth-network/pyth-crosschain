use {
    super::keeper_metrics::{AccountLabel, KeeperMetrics},
    crate::{
        api::BlockchainState,
        chain::{ethereum::InstrumentedSignablePythContract, reader::RequestedWithCallbackEvent},
    },
    anyhow::{anyhow, Result},
    ethers::types::U256,
    fortuna::eth_utils::utils::{submit_tx_with_backoff, EscalationPolicy},
    std::sync::Arc,
    tracing,
};

/// Process an event with backoff. It will retry the reveal on failure for 5 minutes.
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
    // ignore requests that are not for the configured provider
    if chain_state.provider_address != event.provider_address {
        return Ok(());
    }

    let account_label = AccountLabel {
        chain_id: chain_state.id.clone(),
        address: chain_state.provider_address.to_string(),
    };

    metrics.requests.get_or_create(&account_label).inc();
    tracing::info!("Started processing event");

    let provider_revelation = chain_state
        .state
        .reveal(event.sequence_number)
        .map_err(|e| anyhow!("Error revealing: {:?}", e))?;

    let contract_call = contract.reveal_with_callback(
        event.provider_address,
        event.sequence_number,
        event.user_random_number,
        provider_revelation,
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
            metrics.reveals.get_or_create(&account_label).inc();
        }
        Err(e) => {
            // In case the callback did not succeed, we double-check that the request is still on-chain.
            // If the request is no longer on-chain, one of the transactions we sent likely succeeded, but
            // the RPC gave us an error anyway.
            let req = chain_state
                .contract
                .get_request(event.provider_address, event.sequence_number)
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
