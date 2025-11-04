use {
    super::keeper_metrics::AccountLabel,
    crate::{
        chain::reader::{RequestCallbackStatus, RequestedV2Event},
        history::{RequestEntryState, RequestStatus},
        keeper::{
            block::ProcessParams,
            contract::{KeeperTxContract, KeeperTxError},
        },
    },
    anyhow::{anyhow, Result},
    ethers::types::{Bytes, H256, U256},
    tracing,
};

/// Process an event with backoff. It will retry the reveal on failure for 5 minutes.
#[tracing::instrument(name = "process_event_with_backoff", skip_all, fields(
    sequence_number = event.sequence_number
))]
pub async fn process_event_with_backoff<C>(
    event: RequestedV2Event,
    process_param: ProcessParams<C>,
) -> Result<()>
where
    C: KeeperTxContract + 'static,
{
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

    let reveal_result = contract
        .reveal_with_callback(
            event.provider_address,
            event.sequence_number,
            event.user_random_number,
            provider_revelation,
            escalation_policy,
        )
        .await;

    metrics
        .requests_processed
        .get_or_create(&account_label)
        .inc();

    status.last_updated_at = chrono::Utc::now();
    match reveal_result {
        Ok(result) => {
            status.state = RequestEntryState::Completed {
                reveal_block_number: result.block_number.unwrap_or_default(),
                reveal_tx_hash: H256::from_slice(&result.tx_hash.0),
                provider_random_number: provider_revelation,
                gas_used: U256::from(result.gas_used.unwrap_or_default()),
                combined_random_number: RequestStatus::generate_combined_random_number(
                    &event.user_random_number,
                    &provider_revelation,
                ),
                callback_failed: result.result.callback_failed,
                callback_return_value: Bytes::from(result.result.callback_return_value.clone()),
                callback_gas_used: u32::try_from(result.result.callback_gas_used)
                    .unwrap_or(u32::MAX),
            };
            history.add(&status);
            tracing::info!(
                "Processed event successfully in {:?} after {} retries. Receipt: {:?}",
                result.duration,
                result.num_retries,
                result.tx_hash
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

            if let Some(gas_used) = result.gas_used {
                let gas_used_float = gas_used as f64 / 1e18;
                metrics
                    .total_gas_spent
                    .get_or_create(&account_label)
                    .inc_by(gas_used_float);

                if let Some(gas_price) = result.effective_gas_price {
                    let gas_fee = U256::from(gas_used)
                        .saturating_mul(U256::from(gas_price))
                        .as_u128() as f64
                        / 1e18;
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
                let reason = match &e {
                    KeeperTxError::Reverted { reason } => format!("Reverted: {reason}"),
                    KeeperTxError::GasLimit { limit, estimate } => {
                        format!("Gas limit exceeded: limit = {limit}, estimate = {estimate}")
                    }
                    KeeperTxError::Provider { reason } if reason == "gas_price_estimate" => {
                        "Unable to estimate gas price".to_string()
                    }
                    KeeperTxError::Other { reason } if reason == "gas_usage_estimate" => {
                        "Unable to estimate gas usage".to_string()
                    }
                    KeeperTxError::Submission { .. } => {
                        "Error submitting the transaction on-chain".to_string()
                    }
                    KeeperTxError::ConfirmationTimeout { reason } => reason.clone(),
                    KeeperTxError::Confirmation { reason } => reason.clone(),
                    KeeperTxError::Receipt { reason } => reason.clone(),
                    KeeperTxError::Provider { reason } => {
                        format!("Provider error: {reason}")
                    }
                    KeeperTxError::Other { reason } => {
                        format!("Unexpected error: {reason}")
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
