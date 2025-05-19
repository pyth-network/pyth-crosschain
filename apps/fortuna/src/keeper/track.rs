use {
    super::keeper_metrics::{AccountLabel, ChainIdLabel, KeeperMetrics},
    crate::{
        api::ChainId, chain::ethereum::InstrumentedPythContract,
        eth_utils::traced_client::TracedClient,
    },
    anyhow::{anyhow, Result},
    ethers::{middleware::Middleware, prelude::BlockNumber, providers::Provider, types::Address},
    std::{
        sync::Arc,
        time::{SystemTime, UNIX_EPOCH},
    },
    tracing,
};

/// tracks the balance of the given address on the given chain
#[tracing::instrument(skip_all)]
pub async fn track_balance(
    chain_id: String,
    provider: Arc<Provider<TracedClient>>,
    address: Address,
    metrics: Arc<KeeperMetrics>,
) -> Result<()> {
    let balance = provider.get_balance(address, None).await?;
    // This conversion to u128 is fine as the total balance will never cross the limits
    // of u128 practically.
    let balance = balance.as_u128();
    // The f64 conversion is made to be able to serve metrics within the constraints of Prometheus.
    // The balance is in wei, so we need to divide by 1e18 to convert it to eth.
    let balance = balance as f64 / 1e18;

    metrics
        .balance
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address: address.to_string(),
        })
        .set(balance);

    Ok(())
}

/// Tracks the difference between the server timestamp and the latest block timestamp for each chain
#[tracing::instrument(skip_all)]
pub async fn track_block_timestamp_lag(
    chain_id: String,
    provider: Arc<Provider<TracedClient>>,
    metrics: Arc<KeeperMetrics>,
) -> Result<()> {
    let label = ChainIdLabel {
        chain_id: chain_id.clone(),
    };

    let block = provider.get_block(BlockNumber::Latest).await?;
    let block = block.ok_or(anyhow!("block was none"))?;
    let block_timestamp = block.timestamp.as_u64();
    let block_timestamp = i64::try_from(block_timestamp)?;
    let block_number = block
        .number
        .ok_or(anyhow!("block number was none"))?
        .as_u64();

    metrics
        .latest_block_timestamp
        .get_or_create(&label)
        .set(block_timestamp);

    metrics
        .latest_block_number
        .get_or_create(&label)
        .set(block_number as i64);

    let server_timestamp = i64::try_from(SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs())?;

    let lag = server_timestamp - block_timestamp;
    metrics.block_timestamp_lag.get_or_create(&label).set(lag);

    Ok(())
}

/// tracks the collected fees and the hashchain data of the given provider address on the given chain
#[tracing::instrument(skip_all)]
pub async fn track_provider(
    chain_id: ChainId,
    contract: InstrumentedPythContract,
    provider_address: Address,
    metrics: Arc<KeeperMetrics>,
) -> Result<()> {
    let provider_info = contract.get_provider_info(provider_address).call().await?;

    // The f64 conversion is made to be able to serve metrics with the constraints of Prometheus.
    // The fee is in wei, so we divide by 1e18 to convert it to eth.
    let collected_fee = provider_info.accrued_fees_in_wei as f64 / 1e18;
    let current_fee: f64 = provider_info.fee_in_wei as f64 / 1e18;

    let current_sequence_number = provider_info.sequence_number;
    let end_sequence_number = provider_info.end_sequence_number;
    let current_commitment_sequence_number = provider_info.current_commitment_sequence_number;

    metrics
        .collected_fee
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address: provider_address.to_string(),
        })
        .set(collected_fee);

    metrics
        .current_fee
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address: provider_address.to_string(),
        })
        .set(current_fee);

    metrics
        .current_sequence_number
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address: provider_address.to_string(),
        })
        // sequence_number type on chain is u64 but practically it will take
        // a long time for it to cross the limits of i64.
        // currently prometheus only supports i64 for Gauge types
        .set(current_sequence_number as i64);
    metrics
        .current_commitment_sequence_number
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address: provider_address.to_string(),
        })
        // sequence_number type on chain is u64 but practically it will take
        // a long time for it to cross the limits of i64.
        // currently prometheus only supports i64 for Gauge types
        .set(current_commitment_sequence_number as i64);
    metrics
        .end_sequence_number
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address: provider_address.to_string(),
        })
        .set(end_sequence_number as i64);

    Ok(())
}

/// tracks the accrued pyth fees on the given chain
#[tracing::instrument(skip_all)]
pub async fn track_accrued_pyth_fees(
    chain_id: ChainId,
    contract: InstrumentedPythContract,
    metrics: Arc<KeeperMetrics>,
) -> Result<()> {
    let accrued_pyth_fees = contract.get_accrued_pyth_fees().call().await?;

    // The f64 conversion is made to be able to serve metrics with the constraints of Prometheus.
    // The fee is in wei, so we divide by 1e18 to convert it to eth.
    let accrued_pyth_fees = accrued_pyth_fees as f64 / 1e18;

    metrics
        .accrued_pyth_fees
        .get_or_create(&ChainIdLabel {
            chain_id: chain_id.clone(),
        })
        .set(accrued_pyth_fees);

    Ok(())
}
