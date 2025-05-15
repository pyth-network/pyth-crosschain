use ethabi::ethereum_types::U64;
use {
    crate::eth_utils::nonce_manager::NonceManaged,
    anyhow::{anyhow, Result},
    backoff::ExponentialBackoff,
    ethers::{
        contract::ContractCall,
        middleware::Middleware,
        types::TransactionReceipt,
    },
    std::sync::{atomic::AtomicU64, Arc},
    tokio::time::{timeout, Duration},
    tracing,
};

const TX_CONFIRMATION_TIMEOUT_SECS: u64 = 30;

#[derive(Debug)]
pub struct SubmitTxResult {
    pub num_retries: u64,
    pub fee_multiplier: u64,
    pub duration: Duration,
    pub receipt: TransactionReceipt,
}

#[derive(Clone, Debug)]
pub struct EscalationPolicy {
    /// The fee multiplier to apply to the fee during backoff retries.
    /// The initial fee is 100% of the estimate (which itself may be padded based on our chain configuration)
    /// The fee on each successive retry is multiplied by this value, with the maximum multiplier capped at `fee_multiplier_cap_pct`.
    pub fee_multiplier_pct: u64,
    pub fee_multiplier_cap_pct: u64,
}

impl EscalationPolicy {
    pub fn get_fee_multiplier_pct(&self, num_retries: u64) -> u64 {
        self.apply_escalation_policy(
            num_retries,
            100,
            self.fee_multiplier_pct,
            self.fee_multiplier_cap_pct,
        )
    }

    fn apply_escalation_policy(
        &self,
        num_retries: u64,
        initial: u64,
        multiplier: u64,
        cap: u64,
    ) -> u64 {
        let mut current = initial;
        let mut i = 0;
        while i < num_retries && current < cap {
            current = current.saturating_mul(multiplier) / 100;
            i += 1;
        }

        current.min(cap)
    }
}

/// Send a transaction and wait for the receipt to ensure that it was confirmed on chain.
pub async fn send_and_confirm<A: Middleware>(contract_call: ContractCall<A, ()>) -> Result<()> {
    let call_name = contract_call.function.name.as_str();
    let pending_tx = contract_call
        .send()
        .await
        .map_err(|e| anyhow!("Error submitting transaction({}) {:?}", call_name, e))?;

    let tx_result = pending_tx
        .await
        .map_err(|e| {
            anyhow!(
                "Error waiting for transaction({}) receipt: {:?}",
                call_name,
                e
            )
        })?
        .ok_or_else(|| {
            anyhow!(
                "Can't verify the transaction({}), probably dropped from mempool",
                call_name
            )
        })?;

    tracing::info!(
        transaction_hash = &tx_result.transaction_hash.to_string(),
        "Confirmed transaction({}). Receipt: {:?}",
        call_name,
        tx_result,
    );
    Ok(())
}

/// Estimate the cost (in wei) of a transaction consuming gas_used gas.
pub async fn estimate_tx_cost<T: Middleware + 'static>(
    middleware: Arc<T>,
    use_legacy_tx: bool,
    gas_used: u128,
) -> Result<u128> {
    let gas_price: u128 = if use_legacy_tx {
        middleware
            .get_gas_price()
            .await
            .map_err(|e| anyhow!("Failed to fetch gas price. error: {:?}", e))?
            .try_into()
            .map_err(|e| anyhow!("gas price doesn't fit into 128 bits. error: {:?}", e))?
    } else {
        // This is not obvious but the implementation of estimate_eip1559_fees in ethers.rs
        // for a middleware that has a GasOracleMiddleware inside is to ignore the passed-in callback
        // and use whatever the gas oracle returns.
        let (max_fee_per_gas, max_priority_fee_per_gas) =
            middleware.estimate_eip1559_fees(None).await?;

        (max_fee_per_gas + max_priority_fee_per_gas)
            .try_into()
            .map_err(|e| anyhow!("gas price doesn't fit into 128 bits. error: {:?}", e))?
    };

    Ok(gas_price * gas_used)
}

/// Submit a transaction, retrying on failure according to a configurable backoff policy.
/// The transaction is retried with exponentially increasing delay between retries, and
/// similarly escalating gas and fee multipliers.
/// The gas_limit parameter is the maximum gas that we expect the transaction to use -- if the gas estimate for
/// the transaction exceeds this limit, the transaction is not submitted.
/// Note however that any gas_escalation policy is applied to the estimate, so the actual gas used may exceed the limit.
/// The transaction is retried until it is confirmed on chain or the maximum number of retries is reached.
pub async fn submit_tx_with_backoff<T: Middleware + NonceManaged + 'static>(
    middleware: Arc<T>,
    call: ContractCall<T, ()>,
    escalation_policy: EscalationPolicy,
) -> Result<SubmitTxResult> {
    let start_time = std::time::Instant::now();

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

            let fee_multiplier_pct = escalation_policy.get_fee_multiplier_pct(num_retries);
            submit_tx(
                middleware.clone(),
                &call,
                fee_multiplier_pct,
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
    .await?;

    let duration = start_time.elapsed();
    let num_retries = num_retries.load(std::sync::atomic::Ordering::Relaxed);

    Ok(SubmitTxResult {
        num_retries,
        fee_multiplier: escalation_policy.get_fee_multiplier_pct(num_retries),
        duration,
        receipt: success,
    })
}

/// Submit a transaction to the blockchain. It estimates the gas for the transaction,
/// pads both the gas and fee estimates using the provided multipliers, and submits the transaction.
/// It will return a permanent or transient error depending on the error type and whether
/// retry is possible or not.
pub async fn submit_tx<T: Middleware + NonceManaged + 'static>(
    client: Arc<T>,
    call: &ContractCall<T, ()>,
    // A value of 100 submits the tx with the same fee as the estimate.
    fee_estimate_multiplier_pct: u64,
) -> Result<TransactionReceipt, backoff::Error<anyhow::Error>> {

    let mut transaction = call.tx.clone();

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

    tracing::info!("Submitting transaction: {:?}", transaction);

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
        client.reset();
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

    if receipt.status == Some(U64::from(0)) {
        return Err(backoff::Error::transient(anyhow!(
            "Reveal transaction reverted on-chain. Tx:{:?}",
            transaction
        )));
    }

    Ok(receipt)
}
