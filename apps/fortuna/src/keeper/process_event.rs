use {
    super::keeper_metrics::AccountLabel,
    crate::{
        chain::{
            ethereum::PythRandomErrorsErrors,
            reader::{RequestCallbackStatus, RequestedV2Event},
        },
        eth_utils::utils::{submit_tx_with_backoff, SubmitTxError},
        history::{RequestEntryState, RequestStatus},
        keeper::block::ProcessParams,
    },
    anyhow::{anyhow, Result},
    ethers::{abi::AbiDecode, contract::ContractError},
    std::time::Duration,
    tracing,
};

/// Process an event with backoff. It will retry the reveal on failure for 5 minutes.
#[tracing::instrument(name = "process_event_with_backoff", skip_all, fields(
    sequence_number = event.sequence_number
))]
pub async fn process_event_with_backoff(
    event: RequestedV2Event,
    process_param: ProcessParams,
) -> Result<()> {
    let ProcessParams {
        chain_state,
        contract,
        escalation_policy,
        metrics,
        history,
        ..
    } = process_param;

    // ignore requests that are not for the configured provider
    if chain_state.provider_address != event.provider_address {
        return Ok(());
    }

    // If replica config is present, we're running with multiple instances.
    // The incoming request is assigned by modulo operation on the sequence number
    // and the total number of replicas. If our replica_id is the primary for this sequence number,
    // we process the request directly. If our replica_id is a backup, we wait for the delay and
    // then check if the request is still open. If it is, we process it as a backup replica.
    if let Some(replica_config) = &process_param.replica_config {
        let assigned_replica = event.sequence_number % replica_config.total_replicas;
        let is_primary_replica = assigned_replica == replica_config.replica_id;

        if is_primary_replica {
            tracing::debug!("Processing request as primary replica");
        } else {
            tracing::debug!("Processing request as backup replica");

            tracing::info!("Waiting before processing as backup replica");
            tokio::time::sleep(tokio::time::Duration::from_secs(
                replica_config.backup_delay_seconds,
            ))
            .await;

            // Check if the request is still open after the delay.
            // If it is, we will process it as a backup replica.
            match chain_state
                .contract
                .get_request_v2(event.provider_address, event.sequence_number)
                .await
            {
                Ok(Some(req)) => {
                    // If the request is in the CallbackNotStarted state, it means that the primary replica
                    // has not yet called the callback. We should process it as a backup replica.
                    if req.callback_status != RequestCallbackStatus::CallbackNotStarted {
                        tracing::debug!(
                            "Request already handled by primary replica during delay, skipping"
                        );
                        return Ok(());
                    }
                    tracing::info!(
                        delay_seconds = replica_config.backup_delay_seconds,
                        "Request still open after delay, processing as backup replica"
                    );
                }
                Ok(None) => {
                    tracing::debug!(
                        "Request already handled by primary replica during delay, skipping"
                    );
                    return Ok(());
                }
                Err(e) => {
                    tracing::warn!(
                        error = ?e,
                        "Error checking request status after delay, processing as backup replica"
                    );
                }
            }

            let account_label = AccountLabel {
                chain_id: chain_state.id.clone(),
                address: chain_state.provider_address.to_string(),
            };
            metrics
                .request_failovers_triggered
                .get_or_create(&account_label)
                .inc();
        }
    }

    let account_label = AccountLabel {
        chain_id: chain_state.id.clone(),
        address: chain_state.provider_address.to_string(),
    };

    metrics.requests.get_or_create(&account_label).inc();
    tracing::info!("Started processing event");
    let mut status = RequestStatus {
        chain_id: chain_state.id.clone(),
        network_id: chain_state.network_id,
        provider: event.provider_address,
        sequence: event.sequence_number,
        created_at: chrono::Utc::now(),
        last_updated_at: chrono::Utc::now(),
        request_block_number: event.log_meta.block_number.as_u64(),
        request_tx_hash: event.log_meta.transaction_hash,
        sender: event.sender,
        user_random_number: event.user_random_number,
        state: RequestEntryState::Pending,
        gas_limit: event.gas_limit,
    };
    history.add(&status);

    let provider_revelation = chain_state
        .state
        .reveal(event.sequence_number)
        .map_err(|e| {
            status.state = RequestEntryState::Failed {
                reason: format!("Error revealing: {e:?}"),
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
    let error_mapper = |num_retries, e| {
        if let backoff::Error::Transient {
            err: SubmitTxError::GasUsageEstimateError(tx, ContractError::Revert(revert)),
            ..
        } = &e
        {
            if let Ok(PythRandomErrorsErrors::NoSuchRequest(_)) =
                PythRandomErrorsErrors::decode(revert)
            {
                let err = SubmitTxError::GasUsageEstimateError(
                    tx.clone(),
                    ContractError::Revert(revert.clone()),
                );
                // Slow down the retries if the request is not found.
                // This probably means that the request is already fulfilled via another process.
                // After 5 retries, we return the error permanently.
                if num_retries >= 5 {
                    return backoff::Error::Permanent(err);
                }
                let retry_after_seconds = match num_retries {
                    0 => 5,
                    1 => 10,
                    _ => 60,
                };
                return backoff::Error::Transient {
                    err,
                    retry_after: Some(Duration::from_secs(retry_after_seconds)),
                };
            }
        }
        e
    };

    let success = submit_tx_with_backoff(
        contract.client(),
        contract_call,
        escalation_policy,
        Some(error_mapper),
    )
    .await;

    metrics
        .requests_processed
        .get_or_create(&account_label)
        .inc();

    status.last_updated_at = chrono::Utc::now();
    match success {
        Ok(result) => {
            status.state = RequestEntryState::Completed {
                reveal_block_number: result.receipt.block_number.unwrap_or_default().as_u64(),
                reveal_tx_hash: result.receipt.transaction_hash,
                provider_random_number: provider_revelation,
                gas_used: result.receipt.gas_used.unwrap_or_default(),
                combined_random_number: RequestStatus::generate_combined_random_number(
                    &event.user_random_number,
                    &provider_revelation,
                ),
                callback_failed: result.revealed_event.callback_failed,
                callback_return_value: result.revealed_event.callback_return_value,
                callback_gas_used: result.revealed_event.callback_gas_used,
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
                .get_request_v2(event.provider_address, event.sequence_number)
                .await;

            // We only count failures for cases where we are completely certain that the callback failed.
            if req.as_ref().is_ok_and(|x| x.is_some()) {
                tracing::error!("Failed to process event: {}. Request: {:?}", e, req);
                metrics
                    .requests_processed_failure
                    .get_or_create(&account_label)
                    .inc();
                // Do not display the internal error, it might include RPC details.
                let reason = match e {
                    SubmitTxError::GasUsageEstimateError(_, ContractError::Revert(revert)) => {
                        format!("Reverted: {revert}")
                    }
                    SubmitTxError::GasLimitExceeded { limit, estimate } => {
                        format!("Gas limit exceeded: limit = {limit}, estimate = {estimate}")
                    }
                    SubmitTxError::GasUsageEstimateError(_, _) => {
                        "Unable to estimate gas usage".to_string()
                    }
                    SubmitTxError::GasPriceEstimateError(_) => {
                        "Unable to estimate gas price".to_string()
                    }
                    SubmitTxError::SubmissionError(_, _) => {
                        "Error submitting the transaction on-chain".to_string()
                    }
                    SubmitTxError::ConfirmationTimeout(tx) => format!(
                        "Transaction was submitted, but never confirmed. Hash: {}",
                        tx.sighash()
                    ),
                    SubmitTxError::ConfirmationError(tx, _) => format!(
                        "Transaction was submitted, but never confirmed. Hash: {}",
                        tx.sighash()
                    ),
                    SubmitTxError::ReceiptError(tx, _) => {
                        format!("Reveal transaction failed on-chain. Hash: {}", tx.sighash())
                    }
                };
                status.state = RequestEntryState::Failed {
                    reason,
                    provider_random_number: Some(provider_revelation),
                };
                history.add(&status);
            }
        }
    }

    Ok(())
}
