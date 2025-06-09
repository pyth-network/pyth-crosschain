use {
    crate::{
        api::BlockchainState,
        chain::ethereum::InstrumentedSignablePythContract,
        eth_utils::utils::{estimate_tx_cost, send_and_confirm},
        keeper::{AccountLabel, ChainId, KeeperMetrics},
    },
    anyhow::{anyhow, Result},
    ethers::{
        middleware::Middleware,
        signers::Signer,
        types::{Address, U256},
    },
    std::sync::Arc,
    tokio::time::{self, Duration},
    tracing::{self, Instrument},
};

#[tracing::instrument(name = "withdraw_fees", skip_all, fields())]
pub async fn withdraw_fees_wrapper(
    contract: Arc<InstrumentedSignablePythContract>,
    provider_address: Address,
    poll_interval: Duration,
    min_balance: U256,
) {
    loop {
        if let Err(e) = withdraw_fees_if_necessary(contract.clone(), provider_address, min_balance)
            .in_current_span()
            .await
        {
            tracing::error!("Withdrawing fees. error: {:?}", e);
        }
        time::sleep(poll_interval).await;
    }
}

/// Withdraws accumulated fees in the contract as needed to maintain the balance of the keeper wallet.
pub async fn withdraw_fees_if_necessary(
    contract: Arc<InstrumentedSignablePythContract>,
    provider_address: Address,
    min_balance: U256,
) -> Result<()> {
    let provider = contract.provider();
    let wallet = contract.wallet();

    let keeper_balance = provider
        .get_balance(wallet.address(), None)
        .await
        .map_err(|e| anyhow!("Error while getting balance. error: {:?}", e))?;

    let provider_info = contract
        .get_provider_info(provider_address)
        .call()
        .await
        .map_err(|e| anyhow!("Error while getting provider info. error: {:?}", e))?;

    if provider_info.fee_manager != wallet.address() {
        return Err(anyhow!("Fee manager for provider {:?} is not the keeper wallet. Fee manager: {:?} Keeper: {:?}", provider, provider_info.fee_manager, wallet.address()));
    }

    let fees = provider_info.accrued_fees_in_wei;

    if keeper_balance < min_balance && U256::from(fees) > min_balance {
        tracing::info!("Claiming accrued fees...");
        let contract_call = contract.withdraw_as_fee_manager(provider_address, fees);
        send_and_confirm(contract_call).await?;
    } else if keeper_balance < min_balance {
        // NOTE: This log message triggers a grafana alert. If you want to change the text, please change the alert also.
        tracing::warn!("Keeper balance {:?} is too low (< {:?}) but provider fees are not sufficient to top-up.", keeper_balance, min_balance)
    }

    Ok(())
}

#[tracing::instrument(name = "adjust_fee", skip_all)]
#[allow(clippy::too_many_arguments)]
pub async fn adjust_fee_wrapper(
    contract: Arc<InstrumentedSignablePythContract>,
    chain_state: BlockchainState,
    provider_address: Address,
    poll_interval: Duration,
    legacy_tx: bool,
    gas_limit: u64,
    min_profit_pct: u64,
    target_profit_pct: u64,
    max_profit_pct: u64,
    min_fee_wei: u128,
    metrics: Arc<KeeperMetrics>,
) {
    // The maximum balance of accrued fees + provider wallet balance. None if we haven't observed a value yet.
    let mut high_water_pnl: Option<U256> = None;
    // The sequence number where the keeper last updated the on-chain fee. None if we haven't observed it yet.
    let mut sequence_number_of_last_fee_update: Option<u64> = None;
    loop {
        if let Err(e) = adjust_fee_if_necessary(
            contract.clone(),
            chain_state.id.clone(),
            provider_address,
            legacy_tx,
            gas_limit,
            min_profit_pct,
            target_profit_pct,
            max_profit_pct,
            min_fee_wei,
            &mut high_water_pnl,
            &mut sequence_number_of_last_fee_update,
            metrics.clone(),
        )
        .in_current_span()
        .await
        {
            tracing::error!("Fee adjustment failed: {:?}", e);
        }
        time::sleep(poll_interval).await;
    }
}

/// Adjust the fee charged by the provider to ensure that it is profitable at the prevailing gas price.
/// This method targets a fee as a function of the maximum cost of the callback,
/// c = (gas_limit) * (current gas price), with min_fee_wei as a lower bound on the fee.
///
/// The method then updates the on-chain fee if all of the following are satisfied:
/// - the on-chain fee does not fall into an interval [c*min_profit, c*max_profit]. The tolerance
///   factor prevents the on-chain fee from changing with every single gas price fluctuation.
///   Profit scalars are specified in percentage units, min_profit = (min_profit_pct + 100) / 100
/// - either the fee is increasing or the keeper is earning a profit -- i.e., fees only decrease when the keeper is profitable
/// - at least one random number has been requested since the last fee update
///
/// These conditions are intended to make sure that the keeper is profitable while also minimizing the number of fee
/// update transactions.
#[allow(clippy::too_many_arguments)]
pub async fn adjust_fee_if_necessary(
    contract: Arc<InstrumentedSignablePythContract>,
    chain_id: ChainId,
    provider_address: Address,
    legacy_tx: bool,
    gas_limit: u64,
    min_profit_pct: u64,
    target_profit_pct: u64,
    max_profit_pct: u64,
    min_fee_wei: u128,
    high_water_pnl: &mut Option<U256>,
    sequence_number_of_last_fee_update: &mut Option<u64>,
    metrics: Arc<KeeperMetrics>,
) -> Result<()> {
    let provider_info = contract
        .get_provider_info(provider_address)
        .call()
        .await
        .map_err(|e| anyhow!("Error while getting provider info. error: {:?}", e))?;

    if provider_info.fee_manager != contract.wallet().address() {
        return Err(anyhow!("Fee manager for provider {:?} is not the keeper wallet. Fee manager: {:?} Keeper: {:?}", contract.provider(), provider_info.fee_manager, contract.wallet().address()));
    }

    // Calculate target window for the on-chain fee.
    let middleware = contract.client();
    let max_callback_cost: u128 = estimate_tx_cost(middleware, legacy_tx, gas_limit.into())
        .await
        .map_err(|e| anyhow!("Could not estimate transaction cost. error {:?}", e))?;

    let account_label = AccountLabel {
        chain_id: chain_id.clone(),
        address: provider_address.to_string(),
    };

    metrics
        .gas_price_estimate
        .get_or_create(&account_label)
        .set((max_callback_cost / u128::from(gas_limit)) as f64 / 1e9);

    let target_fee_min = std::cmp::max(
        (max_callback_cost * u128::from(min_profit_pct)) / 100,
        min_fee_wei,
    );
    let target_fee = std::cmp::max(
        (max_callback_cost * u128::from(target_profit_pct)) / 100,
        min_fee_wei,
    );
    metrics
        .target_provider_fee
        .get_or_create(&account_label)
        .set(((max_callback_cost * u128::from(target_profit_pct)) / 100) as f64 / 1e18);

    let target_fee_max = std::cmp::max(
        (max_callback_cost * u128::from(max_profit_pct)) / 100,
        min_fee_wei,
    );

    // Calculate current P&L to determine if we can reduce fees.
    let current_keeper_balance = contract
        .provider()
        .get_balance(contract.wallet().address(), None)
        .await
        .map_err(|e| anyhow!("Error while getting balance. error: {:?}", e))?;
    let current_keeper_fees = U256::from(provider_info.accrued_fees_in_wei);
    let current_pnl = current_keeper_balance + current_keeper_fees;

    let can_reduce_fees = match high_water_pnl {
        Some(x) => current_pnl >= *x,
        None => false,
    };

    // Determine if the chain has seen activity since the last fee update.
    let is_chain_active: bool = match sequence_number_of_last_fee_update {
        Some(n) => provider_info.sequence_number > *n,
        None => {
            // We don't want to adjust the fees on server start for unused chains, hence false here.
            false
        }
    };

    let provider_fee: u128 = provider_info.fee_in_wei;
    if is_chain_active
        && ((provider_fee > target_fee_max && can_reduce_fees) || provider_fee < target_fee_min)
    {
        if min_fee_wei * 100 < target_fee {
            return Err(anyhow!("Cowardly refusing to set target fee more than 100x min_fee_wei. Target: {:?} Min: {:?}", target_fee, min_fee_wei));
        }
        tracing::info!(
            "Adjusting fees. Current: {:?} Target: {:?}",
            provider_fee,
            target_fee
        );
        let contract_call = contract.set_provider_fee_as_fee_manager(provider_address, target_fee);
        send_and_confirm(contract_call).await?;

        *sequence_number_of_last_fee_update = Some(provider_info.sequence_number);
    } else {
        tracing::info!(
            "Skipping fee adjustment. Current: {:?} Target: {:?} [{:?}, {:?}] Current Sequence Number: {:?} Last updated sequence number {:?} Current pnl: {:?} High water pnl: {:?}",
            provider_fee,
            target_fee,
            target_fee_min,
            target_fee_max,
            provider_info.sequence_number,
            sequence_number_of_last_fee_update,
            current_pnl,
            high_water_pnl
        )
    }

    // Update high water pnl
    *high_water_pnl = Some(std::cmp::max(
        current_pnl,
        high_water_pnl.unwrap_or(U256::from(0)),
    ));

    // Update sequence number on server start.
    match sequence_number_of_last_fee_update {
        Some(_) => (),
        None => {
            *sequence_number_of_last_fee_update = Some(provider_info.sequence_number);
        }
    };

    Ok(())
}
