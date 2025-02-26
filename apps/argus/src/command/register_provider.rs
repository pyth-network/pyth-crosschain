use {
    crate::{
        chain::ethereum::SignablePythContract,
        config::{Config, EthereumConfig, ProviderConfig, RegisterProviderOptions},
    },
    anyhow::{anyhow, Result},
    ethers::signers::{LocalWallet, Signer},
    std::sync::Arc,
};

/// Register as a price update provider. This method will register the provider with the Pulse contract.
pub async fn register_provider(opts: &RegisterProviderOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    let chain_config = config.get_chain_config(&opts.chain_id)?;

    register_provider_from_config(&config.provider, &chain_config).await?;

    Ok(())
}

pub async fn register_provider_from_config(
    provider_config: &ProviderConfig,
    chain_config: &EthereumConfig,
) -> Result<()> {
    let private_key_string = provider_config.private_key.load()?.ok_or(anyhow!(
        "Please specify a provider private key in the config"
    ))?;

    // Initialize a Provider to interface with the EVM contract.
    let contract =
        Arc::new(SignablePythContract::from_config(chain_config, &private_key_string).await?);

    let wallet = private_key_string.parse::<LocalWallet>()?;
    let provider_address = wallet.address();

    // Register the provider with the contract
    tracing::info!("Registering provider with address: {:?}", provider_address);
    tracing::info!("Provider fee: {}", chain_config.fee);

    // Register the provider with the fee
    if let Some(receipt) = contract
        .register_provider(chain_config.fee)
        .send()
        .await?
        .await?
    {
        tracing::info!("Provider registration successful: {:?}", receipt);
    } else {
        tracing::error!("Provider registration failed: no receipt returned");
        return Err(anyhow!("Provider registration failed: no receipt returned"));
    }

    Ok(())
}
