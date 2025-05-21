use {
    super::keeper_metrics::AccountLabel,
    crate::{
        chain::reader::RequestedWithCallbackEvent,
        eth_utils::utils::submit_tx_with_backoff,
        history::{RequestEntryState, RequestStatus},
        keeper::block::ProcessParams,
    },
    anyhow::{anyhow, Result},
    tracing,
};

/// Process an event with backoff. It will retry the reveal on failure for 5 minutes.
#[tracing::instrument(name = "process_event_with_backoff", skip_all, fields(
    sequence_number = event.sequence_number
))]
pub async fn process_event_with_backoff(
    event: RequestedWithCallbackEvent,
    process_param: ProcessParams,
) -> Result<()> {
    let ProcessParams {
        chain_state,
        contract,
        gas_limit,
        escalation_policy,
        metrics,
        history,
        ..
    } = process_param;

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
    let mut status = RequestStatus {
        chain_id: chain_state.id.clone(),
        provider: event.provider_address,
        sequence: event.sequence_number,
        created_at: chrono::Utc::now(),
        last_updated_at: chrono::Utc::now(),
        request_block_number: event.log_meta.block_number.as_u64(),
        request_tx_hash: event.log_meta.transaction_hash,
        sender: event.requestor,
        user_random_number: event.user_random_number,
        state: RequestEntryState::Pending,
    };
    history.add(&status);

    let provider_revelation = chain_state
        .state
        .reveal(event.sequence_number)
        .map_err(|e| {
            status.state = RequestEntryState::Failed {
                reason: format!("Error revealing: {:?}", e),
                provider_random_number: None,
            };
            history.add(&status);
            anyhow!("Error revealing: {:?}", e)
        })?;

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
        Ok(result) => {
            status.state = RequestEntryState::Completed {
                reveal_block_number: result.receipt.block_number.unwrap_or_default().as_u64(),
                reveal_tx_hash: result.receipt.transaction_hash,
                provider_random_number: provider_revelation,
            };
            history.add(&status);
            tracing::info!(
                "Processed event successfully in {:?} after {} retries. Receipt: {:?}",
                result.duration,
                result.num_retries,
                result.receipt
            );

            metrics
                .requests_processed_success
                .get_or_create(&account_label)
                .inc();

            metrics
                .request_duration_ms
                .get_or_create(&account_label)
                .observe(result.duration.as_millis() as f64);

            // Track retry count, gas multiplier, and fee multiplier for successful transactions
            metrics
                .retry_count
                .get_or_create(&account_label)
                .observe(result.num_retries as f64);

            metrics
                .final_gas_multiplier
                .get_or_create(&account_label)
                .observe(result.gas_multiplier as f64);

            metrics
                .final_fee_multiplier
                .get_or_create(&account_label)
                .observe(result.fee_multiplier as f64);

            if let Some(gas_used) = result.receipt.gas_used {
                let gas_used_float = gas_used.as_u128() as f64 / 1e18;
                metrics
                    .total_gas_spent
                    .get_or_create(&account_label)
                    .inc_by(gas_used_float);

                if let Some(gas_price) = result.receipt.effective_gas_price {
                    let gas_fee = (gas_used * gas_price).as_u128() as f64 / 1e18;
                    metrics
                        .total_gas_fee_spent
                        .get_or_create(&account_label)
                        .inc_by(gas_fee);
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
                status.state = RequestEntryState::Failed {
                    reason: format!("Error revealing: {:?}", e),
                    provider_random_number: Some(provider_revelation),
                };
                history.add(&status);
            }
        }
    }

    Ok(())
}
