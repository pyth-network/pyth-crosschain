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

mod register_provider;
mod request_randomness;

pub use register_provider::register_provider;
pub use request_randomness::request_randomness;

// TODO: Programatically generate this so we don't have to keep committed ABI in sync with the
// contract in the same repo.
abigen!(PythRandom, "src/abi.json");

const PROVIDER: &str = "https://goerli.optimism.io";
pub type PythProvider = PythRandom<SignerMiddleware<Provider<Http>, LocalWallet>>;

async fn provider(key: &str, contract_addr: &str) -> Result<PythProvider, Box<dyn Error>> {
    let provider = Provider::<Http>::try_from(PROVIDER)?;
    let chain_id = provider.get_chainid().await?;
    let wallet__ = key.parse::<LocalWallet>()?.with_chain_id(chain_id.as_u64());

    Ok(PythRandom::new(
        contract_addr.parse::<Address>()?,
        Arc::new(SignerMiddleware::new(provider, wallet__)),
    ))
}
