use {
    crate::eth_utils::nonce_manager::NonceManaged,
    anyhow::{anyhow, Result},
    backoff::ExponentialBackoff,
    ethabi::ethereum_types::U64,
    ethers::{
        contract::{ContractCall, ContractError},
        middleware::Middleware,
        providers::ProviderError,
        types::{transaction::eip2718::TypedTransaction, TransactionReceipt, U256},
    },
    std::{
        fmt::Display,
        sync::{atomic::AtomicU64, Arc},
    },
    tokio::time::{timeout, Duration},
    tracing,
};

const TX_CONFIRMATION_TIMEOUT_SECS: u64 = 30;

#[derive(Debug)]
pub struct SubmitTxResult {
    pub num_retries: u64,
    pub gas_multiplier: u64,
    pub fee_multiplier: u64,
    pub duration: Duration,
    pub receipt: TransactionReceipt,
}

#[derive(Clone, Debug)]
pub struct EscalationPolicy {
    // The keeper will perform the callback as long as the tx is within this percentage of the configured gas limit.
    // Default value is 110, meaning a 10% tolerance over the configured value.
    pub gas_limit_tolerance_pct: u64,

    /// The initial gas multiplier to apply to the tx gas estimate
    pub initial_gas_multiplier_pct: u64,

    /// The gas multiplier to apply to the tx gas estimate during backoff retries.
    /// The gas on each successive retry is multiplied by this value, with the maximum multiplier capped at `gas_multiplier_cap_pct`.
    pub gas_multiplier_pct: u64,
    /// The maximum gas multiplier to apply to the tx gas estimate during backoff retries.
    pub gas_multiplier_cap_pct: u64,

    /// The fee multiplier to apply to the fee during backoff retries.
    /// The initial fee is 100% of the estimate (which itself may be padded based on our chain configuration)
    /// The fee on each successive retry is multiplied by this value, with the maximum multiplier capped at `fee_multiplier_cap_pct`.
    pub fee_multiplier_pct: u64,
    pub fee_multiplier_cap_pct: u64,
}

impl EscalationPolicy {
    pub fn get_gas_multiplier_pct(&self, num_retries: u64) -> u64 {
        self.apply_escalation_policy(
            num_retries,
            self.initial_gas_multiplier_pct,
            self.gas_multiplier_pct,
            self.gas_multiplier_cap_pct,
        )
    }

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
/// You can pass an `error_mapper` function that will be called on each retry with the number of retries and the error.
/// This lets you customize the backoff behavior based on the error type.
pub async fn submit_tx_with_backoff<T: Middleware + NonceManaged + 'static>(
    middleware: Arc<T>,
    call: ContractCall<T, ()>,
    gas_limit: U256,
    escalation_policy: EscalationPolicy,
    error_mapper: Option<
        impl Fn(u64, backoff::Error<SubmitTxError<T>>) -> backoff::Error<SubmitTxError<T>>,
    >,
) -> Result<SubmitTxResult, SubmitTxError<T>> {
    let start_time = std::time::Instant::now();

    tracing::info!("Started processing event");
    let backoff = ExponentialBackoff {
        max_elapsed_time: Some(Duration::from_secs(300)), // retry for 5 minutes
        ..Default::default()
    };

    let num_retries = Arc::new(AtomicU64::new(0));

    let padded_gas_limit = U256::from(escalation_policy.gas_limit_tolerance_pct) * gas_limit / 100;

    let success = backoff::future::retry_notify(
        backoff,
        || async {
            let num_retries = num_retries.load(std::sync::atomic::Ordering::Relaxed);

            let gas_multiplier_pct = escalation_policy.get_gas_multiplier_pct(num_retries);
            let fee_multiplier_pct = escalation_policy.get_fee_multiplier_pct(num_retries);
            let result = submit_tx(
                middleware.clone(),
                &call,
                padded_gas_limit,
                gas_multiplier_pct,
                fee_multiplier_pct,
            )
            .await;
            if let Some(ref mapper) = error_mapper {
                result.map_err(|e| mapper(num_retries, e))
            } else {
                result
            }
        },
        |e, dur| {
            let retry_number = num_retries.load(std::sync::atomic::Ordering::Relaxed);
            tracing::warn!(
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
        gas_multiplier: escalation_policy.get_gas_multiplier_pct(num_retries),
        fee_multiplier: escalation_policy.get_fee_multiplier_pct(num_retries),
        duration,
        receipt: success,
    })
}

pub enum SubmitTxError<T: Middleware + NonceManaged + 'static> {
    GasUsageEstimateError(ContractError<T>),
    GasLimitExceeded { estimate: U256, limit: U256 },
    GasPriceEstimateError(<T as Middleware>::Error),
    SubmissionError(TypedTransaction, <T as Middleware>::Error),
    ConfirmationTimeout(TypedTransaction),
    ConfirmationError(TypedTransaction, ProviderError),
    ReceiptError(TypedTransaction, TransactionReceipt),
}

impl<T> Display for SubmitTxError<T>
where
    T: Middleware + NonceManaged + 'static,
{
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SubmitTxError::GasUsageEstimateError(e) => {
                write!(f, "Error estimating gas for reveal: {:?}", e)
            }
            SubmitTxError::GasLimitExceeded { estimate, limit } => write!(
                f,
                "Gas estimate for reveal with callback is higher than the gas limit {} > {}",
                estimate, limit
            ),
            SubmitTxError::GasPriceEstimateError(e) => write!(f, "Gas price estimate error: {}", e),
            SubmitTxError::SubmissionError(tx, e) => write!(
                f,
                "Error submitting the reveal transaction. Tx:{:?}, Error:{:?}",
                tx, e
            ),
            SubmitTxError::ConfirmationTimeout(tx) => {
                write!(f, "Tx stuck in mempool. Resetting nonce. Tx:{:?}", tx)
            }
            SubmitTxError::ConfirmationError(tx, e) => write!(
                f,
                "Error waiting for transaction receipt. Tx:{:?} Error:{:?}",
                tx, e
            ),
            SubmitTxError::ReceiptError(tx, _) => {
                write!(f, "Reveal transaction reverted on-chain. Tx:{:?}", tx,)
            }
        }
    }
}

/// Submit a transaction to the blockchain. It estimates the gas for the transaction,
/// pads both the gas and fee estimates using the provided multipliers, and submits the transaction.
/// It will return a permanent or transient error depending on the error type and whether
/// retry is possible or not.
pub async fn submit_tx<T: Middleware + NonceManaged + 'static>(
    client: Arc<T>,
    call: &ContractCall<T, ()>,
    gas_limit: U256,
    // A value of 100 submits the tx with the same gas/fee as the estimate.
    gas_estimate_multiplier_pct: u64,
    fee_estimate_multiplier_pct: u64,
) -> Result<TransactionReceipt, backoff::Error<SubmitTxError<T>>> {
    let gas_estimate_res = call.estimate_gas().await;

    let gas_estimate = gas_estimate_res.map_err(|e| {
        // we consider the error transient even if it is a contract revert since
        // it can be because of routing to a lagging RPC node. Retrying such errors will
        // incur a few additional RPC calls, but it is fine.
        backoff::Error::transient(SubmitTxError::GasUsageEstimateError(e))
    })?;

    // The gas limit on the simulated transaction is the maximum expected tx gas estimate,
    // but we are willing to pad the gas a bit to ensure reliable submission.
    if gas_estimate > gas_limit {
        return Err(backoff::Error::permanent(SubmitTxError::GasLimitExceeded {
            estimate: gas_estimate,
            limit: gas_limit,
        }));
    }

    // Pad the gas estimate after checking it against the simulation gas limit.
    let gas_estimate = gas_estimate.saturating_mul(gas_estimate_multiplier_pct.into()) / 100;

    let call = call.clone().gas(gas_estimate);
    let mut transaction = call.tx.clone();

    // manually fill the tx with the gas price info, so we can log the details in case of error
    client
        .fill_transaction(&mut transaction, None)
        .await
        .map_err(|e| backoff::Error::transient(SubmitTxError::GasPriceEstimateError(e)))?;

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
            backoff::Error::transient(SubmitTxError::SubmissionError(transaction.clone(), e))
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
        backoff::Error::transient(SubmitTxError::ConfirmationTimeout(transaction.clone()))
    })?;

    let receipt = pending_receipt
        .map_err(|e| {
            backoff::Error::transient(SubmitTxError::ConfirmationError(transaction.clone(), e))
        })?
        .ok_or_else(|| {
            // RPC may not return an error on tx submission if the nonce is too high.
            // But we will never get a receipt. So we reset the nonce manager to get the correct nonce.
            reset_nonce();
            backoff::Error::transient(SubmitTxError::ConfirmationTimeout(transaction.clone()))
        })?;

    if receipt.status == Some(U64::from(0)) {
        return Err(backoff::Error::transient(SubmitTxError::ReceiptError(
            transaction.clone(),
            receipt.clone(),
        )));
    }

    Ok(receipt)
}
