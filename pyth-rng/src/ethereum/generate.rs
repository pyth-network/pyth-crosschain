use std::error::Error;
use std::sync::Arc;

use ethers::core::types::Address;
use sha3::Digest;

use crate::config::GenerateOptions;

use super::instantiate_contract_from_opts;

/// Run the entire random number generation protocol to produce a random number.
pub async fn generate(opts: &GenerateOptions) -> Result<(), Box<dyn Error>> {
    let contract = Arc::new(instantiate_contract_from_opts(&opts.ethereum).await?);

    let user_randomness = rand::random::<[u8; 32]>();
    let provider = opts.provider.parse::<Address>()?;

    // Request a random number
    let sequence_number = contract.request_wrapper(&provider, &user_randomness, false).await?;

    // Get the committed value from the hash chain
    let provider_randomness = ???;
    // chain.reveal_ith(sequence_number as usize)?

    let random_value = contract.reveal_wrapper(&provider, sequence_number, &user_randomness, &provider_randomness).await?;

    println!("Random number: {:#?}", random_value);

    Ok(())
}
