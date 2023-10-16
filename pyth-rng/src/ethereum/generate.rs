use super::instantiate_contract_from_opts;
use crate::config::RequestRandomnessOptions;
use crate::ethereum::PythRandomEvents;
use crate::state::PebbleHashChain;
use ethabi::RawLog;
use ethers::core::types::Address;
use ethers::middleware::contract::EthLogDecode;
use sha3::Digest;
use sha3::Keccak256;
use std::error::Error;
use std::sync::Arc;

/// Run the complete random number generation prototocol to produce a random number.
pub async fn generate(opts: &RequestRandomnessOptions) -> Result<(), Box<dyn Error>> {
    let contract = Arc::new(instantiate_contract_from_opts(&opts.ethereum).await?);

    // Create new HashChain. We need a real random number to seed this.
    let random = [0u8; 32];
    let chain = PebbleHashChain::from_config(&opts.randomness, random)?;

    let user_randomness = rand::random::<[u8; 32]>();
    let hashed_randomness: [u8; 32] = Keccak256::digest(user_randomness).into();
    let provider = opts.provider.parse::<Address>()?;

    if let Some(r) = contract
        .request(provider, hashed_randomness, false)
        .value(200)
        .send()
        .await?
        .await?
    {
        // Extract Log from TransactionReceipt.
        let l: RawLog = r.logs[0].clone().into();
        if let PythRandomEvents::RequestedFilter(r) = super::PythRandomEvents::decode_log(&l)? {
            let sequence_number = r.request.sequence_number;
            if let Some(r) = contract
                .reveal(
                    provider,
                    sequence_number,
                    user_randomness,
                    chain.reveal_ith(sequence_number as usize)?,
                )
                .send()
                .await?
                .await?
            {
                if let PythRandomEvents::RevealedFilter(r) =
                    super::PythRandomEvents::decode_log(&r.logs[0].clone().into())?
                {
                    println!("Random number: {:#?}", r);
                }
            }
        }
    }

    Ok(())
}
