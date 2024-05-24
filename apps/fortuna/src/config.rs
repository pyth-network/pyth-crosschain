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

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Config {
    pub chains:   HashMap<ChainId, EthereumConfig>,
    pub provider: ProviderConfig,
    pub keeper:   KeeperConfig,
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

    /// The BlockStatus of the block that is considered confirmed.
    /// For example, Finalized, Safe, Latest
    #[serde(default)]
    pub confirmed_block_status: BlockStatus,

    /// Use the legacy transaction format (for networks without EIP 1559)
    #[serde(default)]
    pub legacy_tx: bool,

    /// The gas limit to use for entropy callback transactions.
    pub gas_limit: u64,

    /// How much the provider charges for a request on this chain.
    #[serde(default)]
    pub fee: u128,

    /// Historical commitments made by the provider.
    pub commitments: Option<Vec<Commitment>>,
}


/// A commitment that the provider used to generate random numbers at some point in the past.
/// These historical commitments need to be stored in the configuration to support transition points where
/// the commitment changes. In theory, this information is stored on the blockchain, but unfortunately it
/// is hard to retrieve from there.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Commitment {
    pub seed:                                [u8; 32],
    pub chain_length:                        u64,
    pub original_commitment_sequence_number: u64,
}

/// Configuration values that are common to a single provider (and shared across chains).
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ProviderConfig {
    /// The URI where clients can retrieve random values from this provider,
    /// i.e., wherever fortuna for this provider will be hosted.
    pub uri: String,

    /// The public key of the provider whose requests the server will respond to.
    pub address: Address,

    /// The provider's private key, which is required to register, update the commitment,
    /// or claim fees. This argument *will not* be loaded for commands that do not need
    /// the private key (e.g., running the server).
    pub private_key: SecretString,

    /// The provider's secret which is a 64-char hex string.
    /// The secret is used for generating new hash chains
    pub secret: SecretString,

    /// The length of the hash chain to generate.
    pub chain_length: u64,
}

/// Configuration values for the keeper service that are shared across chains.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct KeeperConfig {
    /// If provided, the keeper will run alongside the Fortuna API service.
    /// The private key is a 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions for entropy callback requests.
    /// This key *does not need to be a registered provider*. In particular, production deployments
    /// should ensure this is a different key in order to reduce the severity of security breaches.
    pub private_key: SecretString,
}

// A secret is a string that can be provided either as a literal in the config,
// or in a separate file. (The separate file option is useful for 1password mounting in production.)
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct SecretString {
    pub value: Option<String>,

    // The name of a file containing the string to read. Note that the file contents is trimmed
    // of leading/trailing whitespace when read.
    pub file: Option<String>,
}

impl SecretString {
    pub fn load(&self) -> Result<Option<String>> {
        match &self.value {
            Some(v) => return Ok(Some(v.clone())),
            _ => {}
        }

        match &self.file {
            Some(v) => {
                return Ok(Some(fs::read_to_string(v)?.trim().to_string()));
            }
            _ => {}
        }

        Ok(None)
    }
}
