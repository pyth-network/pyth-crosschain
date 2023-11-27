use {
    crate::{
        chain::ethereum::SignablePythContract,
        config::{
            Config,
            RegisterProviderOptions,
        },
        state::PebbleHashChain,
    },
    anyhow::Result,
    std::sync::Arc,
};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct CommitmentMetadata {
    pub seed:         [u8; 32],
    pub chain_length: u64,
}

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
    let commitment_length = opts.randomness.chain_length;
    let mut chain = PebbleHashChain::from_config(
        &opts.randomness.secret,
        &opts.chain_id,
        &random,
        commitment_length,
    )?;

    // Arguments to the contract to register our new provider.
    let fee_in_wei = opts.fee;
    let commitment = chain.reveal()?;
    // Store the random seed and chain length in the metadata field so that we can regenerate the hash
    // chain at-will. (This is secure because you can't generate the chain unless you also have the secret)
    let commitment_metadata = CommitmentMetadata {
        seed:         random,
        chain_length: commitment_length,
    };

    if let Some(r) = contract
        .register(
            fee_in_wei,
            commitment,
            bincode::serialize(&commitment_metadata)?.into(),
            commitment_length,
        )
        .send()
        .await?
        .await?
    {
        tracing::info!("Registered provider: {:?}", r);
    }

    Ok(())
}
