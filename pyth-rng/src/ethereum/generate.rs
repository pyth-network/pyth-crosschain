use std::error::Error;
use std::sync::Arc;

use ethers::core::types::Address;
use sha3::Digest;
use crate::api::GetRandomValueResponse;

use crate::config::GenerateOptions;

use super::instantiate_contract_from_opts;

/// Run the entire random number generation protocol to produce a random number.
pub async fn generate(opts: &GenerateOptions) -> Result<(), Box<dyn Error>> {
    let contract = Arc::new(instantiate_contract_from_opts(&opts.ethereum).await?);

    let user_randomness = rand::random::<[u8; 32]>();
    let provider = opts.provider.parse::<Address>()?;

    // FIXME: blockchas
    // Request a random number
    let sequence_number = contract.request_wrapper(&provider, &user_randomness, false).await?;
    println!("Requested the random number with sequence number {:#?}", sequence_number);

    // Get the committed value from the hash chain
    let client = reqwest::Client::new();
    let request_url = client.get(format!("{}/v1/revelation", &opts.url)).query(&[("sequence", sequence_number)]).build()?;
    let resp = client.execute(request_url)
        .await?
        .json::<GetRandomValueResponse>()
        .await?;

    println!("Retrieved the provider's random value. Server response: {:#?}", resp);
    let provider_randomness = resp.value;

    let random_value = contract.reveal_wrapper(&provider, sequence_number, &user_randomness, &provider_randomness).await?;

    println!("Generated random number: {:#?}", random_value);

    Ok(())
}
