use std::error::Error;
use std::sync::Arc;

use ethers::core::types::Address;
use sha3::Digest;

use crate::config::RequestRandomnessOptions;

use super::instantiate_contract_from_opts;

pub async fn request_randomness(opts: &RequestRandomnessOptions) -> Result<(), Box<dyn Error>> {
    let contract = Arc::new(instantiate_contract_from_opts(&opts.ethereum).await?);

    let user_randomness = rand::random::<[u8; 32]>();
    let provider = opts.provider.parse::<Address>()?;

    let sequence_number = contract.request_wrapper(&provider, &user_randomness, false).await?;

    println!("sequence number: {:#?}", sequence_number);

    Ok(())
}
