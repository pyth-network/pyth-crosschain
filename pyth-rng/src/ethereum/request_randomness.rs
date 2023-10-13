use super::provider;
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


// TODO: Don't use hardcoded 32.
// TODO: Use State to access existing random chain, don't regenerate.
pub async fn request_randomness(opts: &RequestRandomnessOptions) -> Result<(), Box<dyn Error>> {
    // Initialize a Provider to interface with the EVM contract.
    let contract = Arc::new(provider(&opts.key, &opts.contract_addr).await?);

    // Create new HashChain. We need a real random number to seed this.
    let random = [0u8; 32];
    let mut secret: [u8; 32] = [0u8; 32];
    secret.copy_from_slice(&hex::decode(opts.secret.clone())?[0..32]);
    let secret: [u8; 32] = Keccak256::digest([random, secret].flatten()).into();
    let chain = PebbleHashChain::new(secret, 32);

    // TODO Hash result.
    let user_randomness = rand::random::<[u8; 32]>();
    let hashed_randomness: [u8; 32] = Keccak256::digest(user_randomness).into();
    let provider = opts.addr.parse::<Address>()?;

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
