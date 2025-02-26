use {
    super::keeper_metrics::{AccountLabel, KeeperMetrics},
    crate::{
        api::ChainId, chain::ethereum::InstrumentedPythContract,
    },
    ethers::middleware::Middleware,
    ethers::{providers::Provider, types::Address},
    fortuna::eth_utils::traced_client::TracedClient,
    std::sync::Arc,
    tracing,
};

/// tracks the balance of the given address on the given chain
/// if there was an error, the function will just return
#[tracing::instrument(skip_all)]
pub async fn track_balance(
    chain_id: String,
    provider: Arc<Provider<TracedClient>>,
    address: Address,
    metrics: Arc<KeeperMetrics>,
) {
    let balance = match provider.get_balance(address, None).await {
        // This conversion to u128 is fine as the total balance will never cross the limits
        // of u128 practically.
        Ok(r) => r.as_u128(),
        Err(e) => {
            tracing::error!("Error while getting balance. error: {:?}", e);
            return;
        }
    };
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
}

/// tracks the collected fees and the hashchain data of the given provider address on the given chain
/// if there is a error the function will just return
#[tracing::instrument(skip_all)]
pub async fn track_provider(
    chain_id: ChainId,
    contract: InstrumentedPythContract,
    provider_address: Address,
    metrics: Arc<KeeperMetrics>,
) {
    let provider_info = match contract.get_provider_info(provider_address).call().await {
        Ok(info) => info,
        Err(e) => {
            tracing::error!("Error while getting provider info. error: {:?}", e);
            return;
        }
    };

    // The f64 conversion is made to be able to serve metrics with the constraints of Prometheus.
    // The fee is in wei, so we divide by 1e18 to convert it to eth.
    let collected_fee = provider_info.accrued_fees_in_wei as f64 / 1e18;
    let current_fee: f64 = provider_info.fee_in_wei as f64 / 1e18;

    let current_sequence_number = provider_info.sequence_number;
    let end_sequence_number = provider_info.end_sequence_number;

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
        .end_sequence_number
        .get_or_create(&AccountLabel {
            chain_id: chain_id.clone(),
            address: provider_address.to_string(),
        })
        .set(end_sequence_number as i64);
}
