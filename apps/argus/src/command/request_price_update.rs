use {
    crate::{
        chain::ethereum::SignablePythContract,
        config::{Config, RequestPriceUpdateOptions},
    },
    anyhow::{anyhow, Result},
    ethers::types::U256,
    std::{sync::Arc, time::{SystemTime, UNIX_EPOCH}},
};

pub async fn request_price_update(opts: &RequestPriceUpdateOptions) -> Result<()> {
    let contract = Arc::new(
        SignablePythContract::from_config(
            &Config::load(&opts.config.config)?.get_chain_config(&opts.chain_id)?,
            &opts.private_key,
        )
        .await?,
    );

    // Parse price IDs (now required)
    let price_ids = parse_price_ids(&opts.price_ids)?;

    // Use current timestamp as publish time
    let current_time = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let publish_time = U256::from(current_time);

    // Set callback gas limit from options
    let callback_gas_limit = U256::from(opts.callback_gas_limit);

    // Request price updates with callback
    let sequence_number = contract
        .request_price_updates_wrapper(publish_time, price_ids, callback_gas_limit)
        .await?;

    tracing::info!("Price update requested with sequence number: {:#?}", sequence_number);

    Ok(())
}

// Helper function to parse comma-separated hex strings into price IDs
fn parse_price_ids(price_ids_str: &str) -> Result<Vec<[u8; 32]>> {
    let ids: Vec<&str> = price_ids_str.split(',').map(|s| s.trim()).collect();

    if ids.is_empty() {
        return Err(anyhow!("No price IDs provided. Please specify at least one price ID."));
    }

    let mut result = Vec::with_capacity(ids.len());

    for id_str in ids {
        let id_str = id_str.trim_start_matches("0x");
        if id_str.len() != 64 {
            return Err(anyhow!("Invalid price ID format: {}. Expected 32-byte hex string (64 characters)", id_str));
        }

        let mut id = [0u8; 32];
        hex::decode_to_slice(id_str, &mut id)
            .map_err(|e| anyhow!("Failed to decode price ID {}: {}", id_str, e))?;

        result.push(id);
    }

    Ok(result)
}
