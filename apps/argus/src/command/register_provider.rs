use {
    crate::{
        api::ChainId,
        chain::ethereum::SignablePythContract,
        config::{Config, EthereumConfig, ProviderConfig, RegisterProviderOptions},
    },
    anyhow::{anyhow, Result},
    std::sync::Arc,
};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct CommitmentMetadata {
    pub seed: [u8; 32],
    pub chain_length: u64,
}

/// Register as a randomness provider. This method will generate and commit to a new random
/// hash chain from the configured secret & a newly generated random value.
pub async fn register_provider(opts: &RegisterProviderOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    let chain_config = config.get_chain_config(&opts.chain_id)?;

    register_provider_from_config(&config.provider, &opts.chain_id, &chain_config).await?;

    Ok(())
}

pub async fn register_provider_from_config(
    provider_config: &ProviderConfig,
    _chain_id: &ChainId,
    chain_config: &EthereumConfig,
) -> Result<()> {
    let private_key_string = provider_config.private_key.load()?.ok_or(anyhow!(
        "Please specify a provider private key in the config"
    ))?;

    // Initialize a Provider to interface with the EVM contract.
    let _contract =
        Arc::new(SignablePythContract::from_config(chain_config, &private_key_string).await?);

    // TODO: implement registration for Pulse

    Ok(())
}
