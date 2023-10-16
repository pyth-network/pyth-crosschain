
mod register_provider;
mod request_randomness;
mod get_request;
mod generate;

pub use register_provider::register_provider;
pub use request_randomness::request_randomness;
pub use get_request::get_request;

use ethers::contract::abigen;
use ethers::core::types::Address;
use ethers::middleware::SignerMiddleware;
use ethers::providers::Http;
use ethers::providers::Middleware;
use ethers::providers::Provider;
use ethers::signers::LocalWallet;
use ethers::signers::Signer;
use ethers::abi::RawLog;
use ethers::contract::EthLogDecode;
use std::error::Error;
use std::sync::Arc;
use crate::config::EthereumOptions;
use anyhow::anyhow;
use sha3::Keccak256;
use sha3::Digest;

// TODO: Programatically generate this so we don't have to keep committed ABI in sync with the
// contract in the same repo.
abigen!(PythRandom, "src/abi.json");

pub type PythContract = PythRandom<SignerMiddleware<Provider<Http>, LocalWallet>>;

pub async fn instantiate_contract_from_opts(opts: &EthereumOptions) -> Result<PythContract, Box<dyn Error>> {
    let provider = Provider::<Http>::try_from(&opts.geth_rpc_addr)?;
    let chain_id = provider.get_chainid().await?;
    let wallet__ = opts.private_key.clone().ok_or(anyhow!("No private key specified"))?.parse::<LocalWallet>()?.with_chain_id(chain_id.as_u64());

    Ok(PythRandom::new(
            opts.contract_addr.parse::<Address>()?,
            Arc::new(SignerMiddleware::new(provider, wallet__)),
        )
    )
}

impl PythContract {

    pub async fn request_wrapper(&self, provider: &Address, user_randomness: &[u8; 32], use_blockhash: bool) -> Result<u64, Box<dyn Error>> {
        let hashed_randomness: [u8; 32] = Keccak256::digest(user_randomness).into();

        if let Some(r) = self
            .request(*provider, hashed_randomness, use_blockhash)
            .value(200)
            .send()
            .await?
            .await?
        {
            // Extract Log from TransactionReceipt.
            let l: RawLog = r.logs[0].clone().into();
            if let PythRandomEvents::RequestedFilter(r) = PythRandomEvents::decode_log(&l)? {
                Ok(r.request.sequence_number)
            } else {
                Err(anyhow!("No log with sequence number").into())
            }
        } else {
            Err(anyhow!("Request failed").into())
        }
    }
}