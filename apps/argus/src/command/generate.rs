use {
    crate::{
        chain::ethereum::{PulseEvents, SignablePythContract},
        config::{Config, GenerateOptions},
    },
    anyhow::{anyhow, Result},
    ethers::{contract::EthLogDecode, types::Bytes},
    std::sync::Arc,
};

/// Request a price update from the Pulse contract and execute the callback.
pub async fn generate(opts: &GenerateOptions) -> Result<()> {
    let contract = Arc::new(
        SignablePythContract::from_config(
            &Config::load(&opts.config.config)?.get_chain_config(&opts.chain_id)?,
            &opts.private_key,
        )
        .await?,
    );

    // Define the price IDs we want to update
    // In a real implementation, these would come from configuration or command line arguments
    let price_ids: Vec<[u8; 32]> = vec![];
    if price_ids.is_empty() {
        return Err(anyhow!("No price IDs specified for update"));
    }

    // Request a price update on the contract
    // The publish_time would typically be the current time or a specific time in the future
    let publish_time = chrono::Utc::now().timestamp() as u64;
    let callback_gas_limit = 500000; // Example gas limit for the callback

    let sequence_number = contract
        .request_price_updates_with_callback(
            publish_time.into(),
            price_ids.clone(),
            callback_gas_limit.into(),
        )
        .send()
        .await?
        .await?
        .ok_or_else(|| anyhow!("Failed to get transaction receipt"))?
        .logs
        .iter()
        .find_map(|log| {
            let raw_log = ethers::abi::RawLog::from(log.clone());
            if let Ok(PulseEvents::PriceUpdateRequestedFilter(event_data)) =
                PulseEvents::decode_log(&raw_log)
            {
                Some(event_data.request.sequence_number)
            } else {
                None
            }
        })
        .ok_or_else(|| anyhow!("Failed to find sequence number in transaction logs"))?;

    tracing::info!(sequence_number = sequence_number, "Price update requested");

    // In a real implementation, we would fetch price data from a source
    // For this example, we'll use empty update data
    let update_data: Vec<Bytes> = vec![];

    // Execute the callback with the price data
    let result = contract
        .execute_callback(sequence_number, update_data, price_ids)
        .send()
        .await?
        .await?;

    if let Some(receipt) = result {
        tracing::info!(
            transaction_hash = ?receipt.transaction_hash,
            "Price update callback executed successfully"
        );
    } else {
        tracing::error!("Price update callback failed: no receipt returned");
    }

    Ok(())
}
