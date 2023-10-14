use super::provider;
use crate::config::GetRequestOptions;
use crate::state::PebbleHashChain;
use ethers::core::types::U256;
use ethers::types::H160;
use sha3::Digest;
use sha3::Keccak256;
use std::error::Error;
use std::sync::Arc;


pub async fn get_request(opts: &GetRequestOptions) -> Result<(), Box<dyn Error>> {
    // Initialize a Provider to interface with the EVM contract.
    let contract = Arc::new(provider(&opts.ethereum).await?);

    if let r = contract.get_request(opts.provider.parse::<H160>()?, opts.sequence).call().await? {
        println!("Found request: {:?}", r);
    }

    Ok(())
}


