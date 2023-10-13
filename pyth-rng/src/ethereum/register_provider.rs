use super::provider;
use crate::config::RegisterProviderOptions;
use crate::state::PebbleHashChain;
use ethers::core::types::U256;
use sha3::Digest;
use sha3::Keccak256;
use std::error::Error;
use std::sync::Arc;


// TODO: Don't use hardcoded 32.
// TODO: Return to use rand::random instead of hardcoded randomness.
pub async fn register_provider(opts: &RegisterProviderOptions) -> Result<(), Box<dyn Error>> {
    // Initialize a Provider to interface with the EVM contract.
    let contract = Arc::new(provider(&opts.provider_key, &opts.contract_addr).await?);

    // Create new HashChain. We need a real random number to seed this.
    let random = [0u8; 32]; // rand::random::<[u8; 32]>();
    let mut secret: [u8; 32] = [0u8; 32];
    secret.copy_from_slice(&hex::decode(opts.secret.clone())?[0..32]);
    let secret: [u8; 32] = Keccak256::digest([random, secret].flatten()).into();
    let mut chain = PebbleHashChain::new(secret, 32);

    // Arguments to the contract to register our new provider.
    let fee_in_wei = U256::from(opts.fee);
    let commitment = chain.reveal()?;
    let commitment_metadata = random;
    let commitment_end = 32;

    if let Some(r) = contract
        .register(fee_in_wei, commitment, commitment_metadata, commitment_end)
        .send()
        .await?
        .await?
    {
        println!("Registered provider: {:?}", r);
    }

    Ok(())
}
