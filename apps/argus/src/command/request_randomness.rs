use {
    crate::{
        chain::ethereum::SignablePythContract,
        config::{Config, RequestRandomnessOptions},
    },
    anyhow::Result,
    ethers::types::U256,
    std::{sync::Arc, time::{SystemTime, UNIX_EPOCH}},
};

pub async fn request_randomness(opts: &RequestRandomnessOptions) -> Result<()> {
    let contract = Arc::new(
        SignablePythContract::from_config(
            &Config::load(&opts.config.config)?.get_chain_config(&opts.chain_id)?,
            &opts.private_key,
        )
        .await?,
    );

    // For Pulse, we need to request price updates instead of random numbers
    // Define some example price IDs to update (these should be replaced with actual price IDs in production)
    let price_ids = vec![[0u8; 32]; 1]; // Example with one price ID

    // Use current timestamp as publish time
    let current_time = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let publish_time = U256::from(current_time);

    // Set a reasonable callback gas limit
    let callback_gas_limit = U256::from(500000); // 500k gas

    // Request price updates with callback
    let sequence_number = contract
        .request_price_updates_wrapper(publish_time, price_ids, callback_gas_limit)
        .await?;

    tracing::info!("Price update requested with sequence number: {:#?}", sequence_number);

    Ok(())
}
