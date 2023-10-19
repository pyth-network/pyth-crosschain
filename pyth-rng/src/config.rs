use {
    crate::api::ChainId,
    anyhow::anyhow,
    clap::{
        crate_authors,
        crate_description,
        crate_name,
        crate_version,
        Args,
        Parser,
    },
    ethers::types::Address,
    std::{
        collections::HashMap,
        error::Error,
        fs,
    },
};
pub use {
    generate::GenerateOptions,
    get_request::GetRequestOptions,
    register_provider::RegisterProviderOptions,
    request_randomness::RequestRandomnessOptions,
    run::RunOptions,
};

mod generate;
mod get_request;
mod register_provider;
mod request_randomness;
mod run;

const DEFAULT_RPC_ADDR: &str = "127.0.0.1:34000";
const DEFAULT_HTTP_ADDR: &str = "http://127.0.0.1:34000";

#[derive(Parser, Debug)]
#[command(name = crate_name!())]
#[command(author = crate_authors!())]
#[command(about = crate_description!())]
#[command(version = crate_version!())]
#[allow(clippy::large_enum_variant)]
pub enum Options {
    /// Run the Randomness Service.
    Run(RunOptions),

    /// Register a new provider with the Pyth Random oracle.
    RegisterProvider(RegisterProviderOptions),

    /// Request a random number from the contract.
    RequestRandomness(RequestRandomnessOptions),

    /// Generate a random number by running the entire protocol end-to-end
    Generate(GenerateOptions),

    /// Get the status of a pending request for a random number.
    GetRequest(GetRequestOptions),
}

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Config Options")]
#[group(id = "Config")]
pub struct ConfigOptions {
    /// Path to a configuration file containing the list of supported blockchains
    #[arg(long = "config")]
    #[arg(env = "PYTH_CONFIG")]
    #[arg(default_value = "config.yaml")]
    pub config: String,
}

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Randomness Options")]
#[group(id = "Randomness")]
pub struct RandomnessOptions {
    /// A secret used for generating new hash chains. A 64-char hex string.
    #[arg(long = "secret")]
    #[arg(env = "PYTH_SECRET")]
    #[arg(default_value = "0000000000000000000000000000000000000000000000000000000000000000")]
    pub secret: String,

    /// The length of the hash chain to generate.
    #[arg(long = "chain-length")]
    #[arg(env = "PYTH_CHAIN_LENGTH")]
    #[arg(default_value = "32")]
    pub chain_length: u64,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Config {
    pub chains: HashMap<ChainId, EthereumConfig>,
}

impl Config {
    pub fn load(path: &str) -> Result<Config, Box<dyn Error>> {
        // Open and read the YAML file
        let yaml_content = fs::read_to_string(path)?;
        let config: Config = serde_yaml::from_str(&yaml_content)?;
        Ok(config)
    }

    pub fn get_chain_config(&self, chain_id: &ChainId) -> Result<EthereumConfig, Box<dyn Error>> {
        self.chains
            .get(chain_id)
            .map(|x| x.clone())
            .ok_or(anyhow!("Could not find chain id {} in the configuration", &chain_id).into())
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct EthereumConfig {
    /// URL of a Geth RPC endpoint to use for interacting with the blockchain.
    pub geth_rpc_addr: String,

    /// Address of a Pyth Randomness contract to interact with.
    pub contract_addr: Address,
}
