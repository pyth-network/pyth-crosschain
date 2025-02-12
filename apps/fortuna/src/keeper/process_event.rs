use {
    super::keeper_metrics::{AccountLabel, KeeperMetrics},
    crate::{
        api::BlockchainState,
        chain::{ethereum::InstrumentedSignablePythContract, reader::RequestedWithCallbackEvent},
        config::EscalationPolicyConfig,
    },
    anyhow::{anyhow, Result},
    backoff::ExponentialBackoff,
    ethers::middleware::Middleware,
    ethers::signers::Signer,
    ethers::types::U256,
    std::sync::{atomic::AtomicU64, Arc},
    tokio::time::{timeout, Duration},
    tracing::{self, Instrument},
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
    escalation_policy: EscalationPolicyConfig,
    metrics: Arc<KeeperMetrics>,
) {
    let start_time = std::time::Instant::now();
    let account_label = AccountLabel {
        chain_id: chain_state.id.clone(),
        address: chain_state.provider_address.to_string(),
    };

    metrics.requests.get_or_create(&account_label).inc();
    tracing::info!("Started processing event");
    let backoff = ExponentialBackoff {
        max_elapsed_time: Some(Duration::from_secs(300)), // retry for 5 minutes
        ..Default::default()
    };

    let num_retries = Arc::new(AtomicU64::new(0));

    let success = backoff::future::retry_notify(
        backoff,
        || async {
            let num_retries = num_retries.load(std::sync::atomic::Ordering::Relaxed);

            let gas_multiplier_pct = escalation_policy.get_gas_multiplier_pct(num_retries);
            let fee_multiplier_pct = escalation_policy.get_fee_multiplier_pct(num_retries);
            process_event(
                &event,
                &chain_state,
                &contract,
                gas_limit.saturating_mul(escalation_policy.gas_limit_tolerance_pct.into()) / 100,
                gas_multiplier_pct,
                fee_multiplier_pct,
                metrics.clone(),
            )
            .await
        },
        |e, dur| {
            let retry_number = num_retries.load(std::sync::atomic::Ordering::Relaxed);
            tracing::error!(
                "Error on retry {} at duration {:?}: {}",
                retry_number,
                dur,
                e
            );
            num_retries.store(retry_number + 1, std::sync::atomic::Ordering::Relaxed);
        },
    )
    .await;

    let duration = start_time.elapsed();

    metrics
        .requests_processed
        .get_or_create(&account_label)
        .inc();

    match success {
        Ok(()) => {
            tracing::info!("Processed event successfully in {:?}", duration);

            metrics
                .requests_processed_success
                .get_or_create(&account_label)
                .inc();

            metrics
                .request_duration_ms
                .get_or_create(&account_label)
                .observe(duration.as_millis() as f64);

            // Track retry count, gas multiplier, and fee multiplier for successful transactions
            let num_retries = num_retries.load(std::sync::atomic::Ordering::Relaxed);
            metrics
                .retry_count
                .get_or_create(&account_label)
                .observe(num_retries as f64);

            let gas_multiplier = escalation_policy.get_gas_multiplier_pct(num_retries);
            metrics
                .final_gas_multiplier
                .get_or_create(&account_label)
                .observe(gas_multiplier as f64);

            let fee_multiplier = escalation_policy.get_fee_multiplier_pct(num_retries);
            metrics
                .final_fee_multiplier
                .get_or_create(&account_label)
                .observe(fee_multiplier as f64);
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
}

const TX_CONFIRMATION_TIMEOUT_SECS: u64 = 30;

/// Process a callback on a chain. It estimates the gas for the reveal with callback and
/// submits the transaction if the gas estimate is below the gas limit.
/// It will return a permanent or transient error depending on the error type and whether
/// retry is possible or not.
pub async fn process_event(
    event: &RequestedWithCallbackEvent,
    chain_config: &BlockchainState,
    contract: &InstrumentedSignablePythContract,
    gas_limit: U256,
    // A value of 100 submits the tx with the same gas/fee as the estimate.
    gas_estimate_multiplier_pct: u64,
    fee_estimate_multiplier_pct: u64,
    metrics: Arc<KeeperMetrics>,
) -> Result<(), backoff::Error<anyhow::Error>> {
    // ignore requests that are not for the configured provider
    if chain_config.provider_address != event.provider_address {
        return Ok(());
    }
    let provider_revelation = chain_config
        .state
        .reveal(event.sequence_number)
        .map_err(|e| backoff::Error::permanent(anyhow!("Error revealing: {:?}", e)))?;

    let gas_estimate_res = chain_config
        .contract
        .estimate_reveal_with_callback_gas(
            contract.wallet().address(),
            event.provider_address,
            event.sequence_number,
            event.user_random_number,
            provider_revelation,
        )
        .in_current_span()
        .await;

    let gas_estimate = gas_estimate_res.map_err(|e| {
        // we consider the error transient even if it is a contract revert since
        // it can be because of routing to a lagging RPC node. Retrying such errors will
        // incur a few additional RPC calls, but it is fine.
        backoff::Error::transient(anyhow!("Error estimating gas for reveal: {:?}", e))
    })?;

    // The gas limit on the simulated transaction is the configured gas limit on the chain,
    // but we are willing to pad the gas a bit to ensure reliable submission.
    if gas_estimate > gas_limit {
        return Err(backoff::Error::permanent(anyhow!(
            "Gas estimate for reveal with callback is higher than the gas limit {} > {}",
            gas_estimate,
            gas_limit
        )));
    }

    // Pad the gas estimate after checking it against the simulation gas limit, ensuring that
    // the padded gas estimate doesn't exceed the maximum amount of gas we are willing to use.
    let gas_estimate = gas_estimate.saturating_mul(gas_estimate_multiplier_pct.into()) / 100;

    let contract_call = contract
        .reveal_with_callback(
            event.provider_address,
            event.sequence_number,
            event.user_random_number,
            provider_revelation,
        )
        .gas(gas_estimate);

    let client = contract.client();
    let mut transaction = contract_call.tx.clone();

    // manually fill the tx with the gas info, so we can log the details in case of error
    client
        .fill_transaction(&mut transaction, None)
        .await
        .map_err(|e| {
            backoff::Error::transient(anyhow!("Error filling the reveal transaction: {:?}", e))
        })?;

    // Apply the fee escalation policy. Note: the unwrap_or_default should never default as we have a gas oracle
    // in the client that sets the gas price.
    transaction.set_gas_price(
        transaction
            .gas_price()
            .unwrap_or_default()
            .saturating_mul(fee_estimate_multiplier_pct.into())
            / 100,
    );

    let pending_tx = client
        .send_transaction(transaction.clone(), None)
        .await
        .map_err(|e| {
            backoff::Error::transient(anyhow!(
                "Error submitting the reveal transaction. Tx:{:?}, Error:{:?}",
                transaction,
                e
            ))
        })?;

    let reset_nonce = || {
        let nonce_manager = contract.client_ref().inner().inner();
        nonce_manager.reset();
    };

    let pending_receipt = timeout(
        Duration::from_secs(TX_CONFIRMATION_TIMEOUT_SECS),
        pending_tx,
    )
    .await
    .map_err(|_| {
        // Tx can get stuck in mempool without any progress if the nonce is too high
        // in this case ethers internal polling will not reduce the number of retries
        // and keep retrying indefinitely. So we set a manual timeout here and reset the nonce.
        reset_nonce();
        backoff::Error::transient(anyhow!(
            "Tx stuck in mempool. Resetting nonce. Tx:{:?}",
            transaction
        ))
    })?;

    let receipt = pending_receipt
        .map_err(|e| {
            backoff::Error::transient(anyhow!(
                "Error waiting for transaction receipt. Tx:{:?} Error:{:?}",
                transaction,
                e
            ))
        })?
        .ok_or_else(|| {
            // RPC may not return an error on tx submission if the nonce is too high.
            // But we will never get a receipt. So we reset the nonce manager to get the correct nonce.
            reset_nonce();
            backoff::Error::transient(anyhow!(
                "Can't verify the reveal, probably dropped from mempool. Resetting nonce. Tx:{:?}",
                transaction
            ))
        })?;

    tracing::info!(
        sequence_number = &event.sequence_number,
        transaction_hash = &receipt.transaction_hash.to_string(),
        gas_used = ?receipt.gas_used,
        "Revealed with res: {:?}",
        receipt
    );

    let account_label = AccountLabel {
        chain_id: chain_config.id.clone(),
        address: chain_config.provider_address.to_string(),
    };

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

    metrics.reveals.get_or_create(&account_label).inc();

    Ok(())
}
