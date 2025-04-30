use {
    crate::{
        api::{get_register_uri, ChainId},
        chain::ethereum::SignablePythContract,
        config::{Config, EthereumConfig, ProviderConfig, RegisterProviderOptions},
        state::PebbleHashChain,
    },
    anyhow::{anyhow, Result},
    ethers::{
        abi::Bytes,
        signers::{LocalWallet, Signer},
        types::U256,
    },
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
    chain_id: &ChainId,
    chain_config: &EthereumConfig,
) -> Result<()> {
    let private_key_string = provider_config.private_key.load()?.ok_or(anyhow!(
        "Please specify a provider private key in the config"
    ))?;

    // Initialize a Provider to interface with the EVM contract.
    let contract =
        Arc::new(SignablePythContract::from_config(chain_config, &private_key_string).await?);
    // Create a new random hash chain.
    let random = rand::random::<[u8; 32]>();
    let secret = provider_config
        .secret
        .load()?
        .ok_or(anyhow!("Please specify a provider secret in the config"))?;

    let commitment_length = provider_config.chain_length;
    tracing::info!("Generating hash chain");
    let chain = PebbleHashChain::from_config_async(
        &secret,
        chain_id,
        &private_key_string.parse::<LocalWallet>()?.address(),
        &chain_config.contract_addr,
        &random,
        commitment_length,
        provider_config.chain_sample_interval,
    )
    .await?;
    tracing::info!("Done generating hash chain");

    // Arguments to the contract to register our new provider.
    let fee_in_wei = chain_config.fee;
    let commitment = chain.reveal_ith(0)?;
    // Store the random seed and chain length in the metadata field so that we can regenerate the hash
    // chain at-will. (This is secure because you can't generate the chain unless you also have the secret)
    let commitment_metadata = CommitmentMetadata {
        seed: random,
        chain_length: commitment_length,
    };
    let uri = get_register_uri(&provider_config.uri, chain_id)?;
    let call = contract.register(
        fee_in_wei,
        commitment,
        bincode::serialize(&commitment_metadata)?.into(),
        commitment_length,
        // Use Bytes to serialize the uri. Most users will be using JS/TS to deserialize this uri.
        // Bincode is a different encoding mechanisms, and I didn't find any JS/TS library to parse bincode.
        Bytes::from(uri.as_str()).into(),
    );
    let mut gas_estimate = call.estimate_gas().await?;
    let gas_multiplier = U256::from(2); //TODO: smarter gas estimation
    gas_estimate *= gas_multiplier;
    let call_with_gas = call.gas(gas_estimate);
    if let Some(r) = call_with_gas.send().await?.await? {
        tracing::info!("Registered provider: {:?}", r);
    }

    Ok(())
}
