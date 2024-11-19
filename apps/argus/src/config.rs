use {
    alloy::{
        primitives::Address,
        providers::{Provider, ProviderBuilder},
        signers::Signer,
    },
    anyhow::Result,
    serde::Deserialize,
    std::{fs, time::Duration},
};

#[derive(Debug, Deserialize)]
pub struct Config {
    pub chains: HashMap<String, ChainConfig>,
    pub provider: ProviderConfig,
    pub keeper: KeeperConfig,
}

#[derive(Debug, Deserialize)]
pub struct ChainConfig {
    pub geth_rpc_addr: String,
    pub contract_addr: Address,
    pub poll_interval: u64,  // in seconds
    pub min_batch_size: usize,
    pub max_batch_size: usize,
    pub batch_timeout: u64,  // in seconds
    pub min_keeper_balance: u64,
    pub gas_limit: u64,
}

#[derive(Debug, Deserialize)]
pub struct ProviderConfig {
    pub uri: String,
    pub address: Address,
    pub private_key: SecretString,
}

#[derive(Debug, Deserialize)]
pub struct KeeperConfig {
    pub private_key: SecretString,
}

#[derive(Debug, Deserialize)]
pub struct SecretString(String);

impl Config {
    pub fn load(path: &str) -> Result<Self> {
        let contents = fs::read_to_string(path)?;
        Ok(serde_yaml::from_str(&contents)?)
    }

    pub fn create_provider(&self, chain_id: &str) -> Result<Provider> {
        let chain = self.chains.get(chain_id).ok_or_else(|| anyhow!("Chain not found"))?;
        Ok(Provider::builder().rpc_url(&chain.geth_rpc_addr).build()?)
    }

    pub fn create_signer(&self, secret: &SecretString) -> Result<Signer> {
        Ok(Signer::from_private_key(secret.0.parse()?)?)
    }
}
