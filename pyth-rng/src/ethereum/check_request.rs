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
pub async fn check_request(opts: &RegisterProviderOptions, provider: String, sequence: u64) -> Result<(), Box<dyn Error>> {
    // Initialize a Provider to interface with the EVM contract.
    let contract = Arc::new(provider(&opts.provider_key, &opts.contract_addr).await?);

    if let Some(r) = contract.get_request(provider, sequence).send().await?.await? {
        println!("Found request: {:?}", r);
    }

    Ok(())
}


