use {
    crate::{
        config::{
            Config,
            RegisterProviderOptions,
        },
        ethereum::SignablePythContract,
        state::PebbleHashChain,
    },
    anyhow::Result,
    std::sync::Arc,
};

/// Register as a randomness provider. This method will generate and commit to a new random
/// hash chain from the configured secret & a newly generated random value.
pub async fn register_provider(opts: &RegisterProviderOptions) -> Result<()> {
    // Initialize a Provider to interface with the EVM contract.
    let contract = Arc::new(
        SignablePythContract::from_config(
            &Config::load(&opts.config.config)?.get_chain_config(&opts.chain_id)?,
            &opts.private_key,
        )
        .await?,
    );

    // Create a new random hash chain.
    let random = rand::random::<[u8; 32]>();
    let mut chain = PebbleHashChain::from_config(&opts.randomness, &opts.chain_id, random)?;

    // Arguments to the contract to register our new provider.
    let fee_in_wei = opts.fee;
    let commitment = chain.reveal()?;
    // Store the random seed in the metadata field so that we can regenerate the hash chain
    // at-will. (This is secure because you can't generate the chain unless you also have the secret)
    let commitment_metadata = random;
    let commitment_length = opts.randomness.chain_length;

    if let Some(r) = contract
        .register(
            fee_in_wei,
            commitment,
            commitment_metadata,
            commitment_length,
        )
        .legacy()
        .send()
        .await?
        .await?
    {
        tracing::info!("Registered provider: {:?}", r);
    }

    Ok(())
}
