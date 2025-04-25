use {
    crate::{
        chain::ethereum::PythContract,
        config::{Config, GetRequestOptions},
    },
    anyhow::Result,
    std::sync::Arc,
};

/// Get the on-chain request metadata for a provider and sequence number.
pub async fn get_request(opts: &GetRequestOptions) -> Result<()> {
    // Initialize a Provider to interface with the EVM contract.
    let contract = Arc::new(PythContract::from_config(
        &Config::load(&opts.config.config)?.get_chain_config(&opts.chain_id)?,
    )?);

    let p = contract.get_provider_info(opts.provider).call().await?;

    tracing::info!("Found provider: {:?}", p);

    let r = contract
        .get_request(opts.provider, opts.sequence)
        .call()
        .await?;
    tracing::info!("Found request: {:?}", r);

    Ok(())
}
