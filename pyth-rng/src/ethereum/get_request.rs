use super::instantiate_contract_from_opts;
use crate::config::GetRequestOptions;
use crate::state::PebbleHashChain;
use ethers::core::types::Address;
use std::error::Error;
use std::sync::Arc;

/// Get the on-chain request metadata for a provider and sequence number.
pub async fn get_request(opts: &GetRequestOptions) -> Result<(), Box<dyn Error>> {
    // Initialize a Provider to interface with the EVM contract.
    let contract = Arc::new(instantiate_contract_from_opts(&opts.ethereum).await?);

    if let r = contract.get_request(opts.provider.parse::<Address>()?, opts.sequence).call().await? {
        println!("Found request: {:?}", r);
    }

    Ok(())
}


