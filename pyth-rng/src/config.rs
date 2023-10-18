use {
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
        error::Error,
        fs,
    },
};


mod generate;
mod get_request;
mod register_provider;
mod request_randomness;
mod run;

use crate::api::ChainId;
pub use {
    generate::GenerateOptions,
    get_request::GetRequestOptions,
    register_provider::RegisterProviderOptions,
    request_randomness::RequestRandomnessOptions,
    run::RunOptions,
};

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

    GetRequest(GetRequestOptions),
}

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Config Options")]
#[group(id = "Config")]
pub struct ConfigOptions {
    /// A secret used for generating new hash chains. A 64-char hex string.
    #[arg(long = "config")]
    #[arg(env = "PYTH_CONFIG")]
    #[arg(default_value = "config.yaml")]
    pub config: String,
}

impl ConfigOptions {
    pub fn load(&self) -> Result<Config, Box<dyn Error>> {
        // Open and read the YAML file
        let yaml_content = fs::read_to_string(&self.config)?;
        let config: Config = serde_yaml::from_str(&yaml_content)?;

        config.check_is_valid()?;

        Ok(config)
    }
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
    pub chains: Vec<EthereumConfig>,
}

impl Config {
    pub fn check_is_valid(&self) -> Result<(), Box<dyn Error>> {
        // TODO: check that chain ids are unique
        Ok(())
    }

    pub fn get_chain_config(&self, chain_id: &ChainId) -> Result<&EthereumConfig, Box<dyn Error>> {
        self.chains.iter().find(|x| x.chain_id == chain_id).ok_or(
            anyhow!(format!(
                "Could not find chain_id {} in the configuration file",
                &chain_id
            ))
            .into(),
        )
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct EthereumConfig {
    /// A unique identifier for the chain. Endpoints of this server require users to pass
    /// this value to identify which blockchain they are operating on.
    pub chain_id: ChainId,

    /// URL of a Geth RPC endpoint to use for interacting with the blockchain.
    pub geth_rpc_addr: String,

    /// Address of a Pyth Randomness contract to interact with.
    pub contract_addr: Address,
}
