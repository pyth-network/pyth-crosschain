
mod register_provider;
mod request_randomness;
mod get_request;

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
use std::error::Error;
use std::sync::Arc;
use crate::config::EthereumOptions;
use anyhow::anyhow;

// TODO: Programatically generate this so we don't have to keep committed ABI in sync with the
// contract in the same repo.
abigen!(PythRandom, "src/abi.json");

pub type PythProvider = PythRandom<SignerMiddleware<Provider<Http>, LocalWallet>>;

pub async fn provider(opts: &EthereumOptions) -> Result<PythProvider, Box<dyn Error>> {
    let provider = Provider::<Http>::try_from(&opts.geth_rpc_addr)?;
    let chain_id = provider.get_chainid().await?;
    let wallet__ = opts.private_key.clone().ok_or(anyhow!("No private key specified"))?.parse::<LocalWallet>()?.with_chain_id(chain_id.as_u64());

    Ok(PythRandom::new(
        opts.contract_addr.parse::<Address>()?,
        Arc::new(SignerMiddleware::new(provider, wallet__)),
    ))
}
