use {
    crate::{
        api::ChainId,
        chain::reader::{
            BlockNumber,
            BlockStatus,
        },
    },
    anyhow::{
        anyhow,
        Result,
    },
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
        fs,
    },
};
pub use {
    generate::GenerateOptions,
    get_request::GetRequestOptions,
    inspect::InspectOptions,
    register_provider::RegisterProviderOptions,
    request_randomness::RequestRandomnessOptions,
    run::RunOptions,
    setup_provider::SetupProviderOptions,
};

mod generate;
mod get_request;
mod inspect;
mod register_provider;
mod request_randomness;
mod run;
mod setup_provider;

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

    /// Set up the provider for all the provided chains.
    /// It registers, re-registers, or updates provider config on chain.
    SetupProvider(SetupProviderOptions),

    /// Request a random number from the contract.
    RequestRandomness(RequestRandomnessOptions),

    /// Inspect recent requests and find unfulfilled requests with callback.
    Inspect(InspectOptions),

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
    #[arg(env = "FORTUNA_CONFIG")]
    #[arg(default_value = "config.yaml")]
    pub config: String,
}

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Randomness Options")]
#[group(id = "Randomness")]
pub struct RandomnessOptions {
    /// Path to file containing a secret which is a 64-char hex string.
    /// The secret is used for generating new hash chains
    #[arg(long = "secret")]
    #[arg(env = "FORTUNA_SECRET")]
    pub secret_file: String,

    /// The length of the hash chain to generate.
    #[arg(long = "chain-length")]
    #[arg(env = "FORTUNA_CHAIN_LENGTH")]
    #[arg(default_value = "100000")]
    pub chain_length: u64,
}

impl RandomnessOptions {
    pub fn load_secret(&self) -> Result<String> {
        return Ok((fs::read_to_string(&self.secret_file))?);
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Config {
    pub chains: HashMap<ChainId, EthereumConfig>,
}

impl Config {
    pub fn load(path: &str) -> Result<Config> {
        // Open and read the YAML file
        // TODO: the default serde deserialization doesn't enforce unique keys
        let yaml_content = fs::read_to_string(path)?;
        let config: Config = serde_yaml::from_str(&yaml_content)?;
        Ok(config)
    }

    pub fn get_chain_config(&self, chain_id: &ChainId) -> Result<EthereumConfig> {
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

    /// URL of a Geth RPC wss endpoint to use for subscribing to blockchain events.
    pub geth_rpc_wss: Option<String>,

    /// Address of a Pyth Randomness contract to interact with.
    pub contract_addr: Address,

    /// reveal_delay_blocks - The difference between the block number with the
    /// confirmed_block_status(see below) and the block number of a request to
    /// Entropy should be greater than `reveal_delay_blocks` for Fortuna to reveal
    /// its commitment.
    pub reveal_delay_blocks: BlockNumber,

    /// Use the legacy transaction format (for networks without EIP 1559)
    #[serde(default)]
    pub legacy_tx: bool,

    /// The BlockStatus of the block that is considered confirmed.
    /// For example, Finalized, Safe, Latest
    #[serde(default)]
    pub confirmed_block_status: BlockStatus,

    /// The gas limit to use for entropy callback transactions.
    pub gas_limit: u64,
}

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Provider Config Options")]
#[group(id = "ProviderConfig")]
pub struct ProviderConfigOptions {
    #[arg(long = "provider-config")]
    #[arg(env = "FORTUNA_PROVIDER_CONFIG")]
    pub provider_config: String,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ProviderConfig {
    pub chains: HashMap<ChainId, ProviderChainConfig>,
}

impl ProviderConfig {
    pub fn load(path: &str) -> Result<ProviderConfig> {
        // Open and read the YAML file
        let yaml_content = fs::read_to_string(path)?;
        let config: ProviderConfig = serde_yaml::from_str(&yaml_content)?;
        Ok(config)
    }

    /// Get the provider chain config. The method returns an Option for ProviderChainConfig.
    /// We may not have past any commitments for a chain. For example, for a new chain
    pub fn get_chain_config(&self, chain_id: &ChainId) -> Result<ProviderChainConfig> {
        self.chains.get(chain_id).map(|x| x.clone()).ok_or(
            anyhow!(
                "Could not find chain id {} in provider configuration",
                &chain_id
            )
            .into(),
        )
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ProviderChainConfig {
    commitments: Option<Vec<Commitment>>,
    pub fee:     u128,
}

impl ProviderChainConfig {
    /// Returns a clone of the commitments in the sorted order.
    /// `HashChainState`  requires offsets to be in order.
    pub fn get_sorted_commitments(&self) -> Vec<Commitment> {
        let mut commitments = self.commitments.clone().unwrap_or(Vec::new());
        commitments.sort_by(|c1, c2| {
            c1.original_commitment_sequence_number
                .cmp(&c2.original_commitment_sequence_number)
        });
        commitments
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Commitment {
    pub seed:                                [u8; 32],
    pub chain_length:                        u64,
    pub original_commitment_sequence_number: u64,
}
