use crate::ethereum::PythContract;
use crate::config::RegisterProviderOptions;
use crate::state::PebbleHashChain;
use ethers::core::types::U256;
use std::error::Error;
use std::sync::Arc;

/// Register as a randomness provider. This method will generate and commit to a new random
/// hash chain from the configured secret & a newly generated random value.
pub async fn register_provider(opts: &RegisterProviderOptions) -> Result<(), Box<dyn Error>> {
    // Initialize a Provider to interface with the EVM contract.
    let contract = Arc::new(PythContract::from_opts(&opts.ethereum).await?);

    // Create a new random hash chain.
    let random = rand::random::<[u8; 32]>();
    let mut chain = PebbleHashChain::from_config(&opts.randomness, random)?;

    // Arguments to the contract to register our new provider.
    let fee_in_wei = U256::from(opts.fee);
    let commitment = chain.reveal()?;
    // Store the random seed in the metadata field so that we can regenerate the hash chain
    // at-will. (This is secure because you can't generate the chain unless you also have the secret)
    let commitment_metadata = random;
    let commitment_length = opts.randomness.chain_length;

    if let Some(r) = contract
        .register(fee_in_wei, commitment, commitment_metadata, commitment_length)
        .send()
        .await?
        .await?
    {
        println!("Registered provider: {:?}", r);
    }

    Ok(())
}
