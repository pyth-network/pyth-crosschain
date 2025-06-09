use {
    crate::{
        api::ChainId,
        chain::reader::{BlockNumber, BlockStatus},
        eth_utils::utils::EscalationPolicy,
    },
    anyhow::{anyhow, Result},
    clap::{crate_authors, crate_description, crate_name, crate_version, Args, Parser},
    ethers::types::Address,
    std::{collections::HashMap, fs},
};
pub use {
    generate::GenerateOptions, get_request::GetRequestOptions, inspect::InspectOptions,
    prometheus_client::metrics::histogram::Histogram, register_provider::RegisterProviderOptions,
    request_randomness::RequestRandomnessOptions, run::RunOptions,
    setup_provider::SetupProviderOptions, withdraw_fees::WithdrawFeesOptions,
};

mod generate;
mod get_request;
mod inspect;
mod register_provider;
mod request_randomness;
mod run;
mod setup_provider;
mod withdraw_fees;

const DEFAULT_RPC_ADDR: &str = "127.0.0.1:34000";

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

    /// Withdraw any of the provider's accumulated fees from the contract.
    WithdrawFees(WithdrawFeesOptions),
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
    pub chains: HashMap<ChainId, EthereumConfig>,
    pub provider: ProviderConfig,
    pub keeper: KeeperConfig,
}

impl Config {
    pub fn load(path: &str) -> Result<Config> {
        // Open and read the YAML file
        // TODO: the default serde deserialization doesn't enforce unique keys
        let yaml_content = fs::read_to_string(path)?;
        let config: Config = serde_yaml::from_str(&yaml_content)?;

        // Run correctness checks for the config and fail if there are any issues.
        for (chain_id, config) in config.chains.iter() {
            if !(config.min_profit_pct <= config.target_profit_pct
                && config.target_profit_pct <= config.max_profit_pct)
            {
                return Err(anyhow!("chain id {:?} configuration is invalid. Config must satisfy min_profit_pct <= target_profit_pct <= max_profit_pct.", chain_id));
            }
        }

        Ok(config)
    }

    pub fn get_chain_config(&self, chain_id: &ChainId) -> Result<EthereumConfig> {
        self.chains.get(chain_id).cloned().ok_or(anyhow!(
            "Could not find chain id {} in the configuration",
            &chain_id
        ))
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct EthereumConfig {
    /// URL of a Geth RPC endpoint to use for interacting with the blockchain.
    /// TODO: Change type from String to Url
    pub geth_rpc_addr: String,

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

    /// The number of blocks to look back for events that might be missed when starting the keeper
    #[serde(default = "default_backlog_range")]
    pub backlog_range: u64,

    /// Use the legacy transaction format (for networks without EIP 1559)
    #[serde(default)]
    pub legacy_tx: bool,

    /// The gas limit to use for entropy callback transactions.
    pub gas_limit: u64,

    /// The percentage multiplier to apply to priority fee estimates (100 = no change, e.g. 150 = 150% of base fee)
    #[serde(default = "default_priority_fee_multiplier_pct")]
    pub priority_fee_multiplier_pct: u64,

    /// The escalation policy governs how the gas limit and fee are increased during backoff retries.
    #[serde(default)]
    pub escalation_policy: EscalationPolicyConfig,

    /// The minimum percentage profit to earn as a function of the callback cost.
    /// For example, 20 means a profit of 20% over the cost of a callback that uses the full gas limit.
    /// The fee will be raised if the profit is less than this number.
    /// The minimum value for this is -100. If set to < 0, it means the keeper may lose money on callbacks that use the full gas limit.
    pub min_profit_pct: i64,

    /// The target percentage profit to earn as a function of the callback cost.
    /// For example, 20 means a profit of 20% over the cost of a callback that uses the full gas limit.
    /// The fee will be set to this target whenever it falls outside the min/max bounds.
    /// The minimum value for this is -100. If set to < 0, it means the keeper may lose money on callbacks that use the full gas limit.
    pub target_profit_pct: i64,

    /// The maximum percentage profit to earn as a function of the callback cost.
    /// For example, 100 means a profit of 100% over the cost of a callback that uses the full gas limit.
    /// The fee will be lowered if it is more profitable than specified here.
    /// Must be larger than min_profit_pct.
    /// The minimum value for this is -100. If set to < 0, it means the keeper may lose money on callbacks that use the full gas limit.
    pub max_profit_pct: i64,

    /// Minimum wallet balance for the keeper. If the balance falls below this level, the keeper will
    /// withdraw fees from the contract to top up. This functionality requires the keeper to be the fee
    /// manager for the provider.
    #[serde(default)]
    pub min_keeper_balance: u128,

    /// How much the provider charges for a request on this chain.
    #[serde(default)]
    pub fee: u128,

    /// Only set the provider's fee when the provider is registered for the first time. Default is true.
    /// This is useful to avoid resetting the fees on service restarts.
    #[serde(default = "default_sync_fee_only_on_register")]
    pub sync_fee_only_on_register: bool,

    /// Historical commitments made by the provider.
    pub commitments: Option<Vec<Commitment>>,

    /// Maximum number of hashes to record in a request.
    /// This should be set according to the maximum gas limit the provider supports for callbacks.
    pub max_num_hashes: Option<u32>,

    /// A list of delays (in blocks) that indicates how many blocks should be delayed
    /// before we process a block. For retry logic, we can process blocks multiple times
    /// at each specified delay. For example: [5, 10, 20].
    #[serde(default = "default_block_delays")]
    pub block_delays: Vec<u64>,
}

fn default_sync_fee_only_on_register() -> bool {
    true
}

fn default_block_delays() -> Vec<u64> {
    vec![5]
}

fn default_priority_fee_multiplier_pct() -> u64 {
    100
}

fn default_backlog_range() -> u64 {
    1000
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct EscalationPolicyConfig {
    // The keeper will perform the callback as long as the tx is within this percentage of the configured gas limit.
    // Default value is 110, meaning a 10% tolerance over the configured value.
    #[serde(default = "default_gas_limit_tolerance_pct")]
    pub gas_limit_tolerance_pct: u64,

    /// The initial gas multiplier to apply to the tx gas estimate
    #[serde(default = "default_initial_gas_multiplier_pct")]
    pub initial_gas_multiplier_pct: u64,

    /// The gas multiplier to apply to the tx gas estimate during backoff retries.
    /// The gas on each successive retry is multiplied by this value, with the maximum multiplier capped at `gas_multiplier_cap_pct`.
    #[serde(default = "default_gas_multiplier_pct")]
    pub gas_multiplier_pct: u64,
    /// The maximum gas multiplier to apply to the tx gas estimate during backoff retries.
    #[serde(default = "default_gas_multiplier_cap_pct")]
    pub gas_multiplier_cap_pct: u64,

    /// The fee multiplier to apply to the fee during backoff retries.
    /// The initial fee is 100% of the estimate (which itself may be padded based on our chain configuration)
    /// The fee on each successive retry is multiplied by this value, with the maximum multiplier capped at `fee_multiplier_cap_pct`.
    #[serde(default = "default_fee_multiplier_pct")]
    pub fee_multiplier_pct: u64,
    #[serde(default = "default_fee_multiplier_cap_pct")]
    pub fee_multiplier_cap_pct: u64,
}

fn default_gas_limit_tolerance_pct() -> u64 {
    110
}

fn default_initial_gas_multiplier_pct() -> u64 {
    125
}

fn default_gas_multiplier_pct() -> u64 {
    110
}

fn default_gas_multiplier_cap_pct() -> u64 {
    600
}

fn default_fee_multiplier_pct() -> u64 {
    110
}

fn default_fee_multiplier_cap_pct() -> u64 {
    200
}

impl Default for EscalationPolicyConfig {
    fn default() -> Self {
        Self {
            gas_limit_tolerance_pct: default_gas_limit_tolerance_pct(),
            initial_gas_multiplier_pct: default_initial_gas_multiplier_pct(),
            gas_multiplier_pct: default_gas_multiplier_pct(),
            gas_multiplier_cap_pct: default_gas_multiplier_cap_pct(),
            fee_multiplier_pct: default_fee_multiplier_pct(),
            fee_multiplier_cap_pct: default_fee_multiplier_cap_pct(),
        }
    }
}

impl EscalationPolicyConfig {
    pub fn to_policy(&self) -> EscalationPolicy {
        EscalationPolicy {
            gas_limit_tolerance_pct: self.gas_limit_tolerance_pct,
            initial_gas_multiplier_pct: self.initial_gas_multiplier_pct,
            gas_multiplier_pct: self.gas_multiplier_pct,
            gas_multiplier_cap_pct: self.gas_multiplier_cap_pct,
            fee_multiplier_pct: self.fee_multiplier_pct,
            fee_multiplier_cap_pct: self.fee_multiplier_cap_pct,
        }
    }
}

/// A commitment that the provider used to generate random numbers at some point in the past.
/// These historical commitments need to be stored in the configuration to support transition points where
/// the commitment changes. In theory, this information is stored on the blockchain, but unfortunately it
/// is hard to retrieve from there.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Commitment {
    pub seed: [u8; 32],
    pub chain_length: u64,
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

    /// How frequently the hash chain is sampled -- increase this value to tradeoff more
    /// compute per request for less RAM use.
    #[serde(default = "default_chain_sample_interval")]
    pub chain_sample_interval: u64,

    /// The address of the fee manager for the provider. Set this value to the keeper wallet address to
    /// enable keeper balance top-ups.
    pub fee_manager: Option<Address>,
}

fn default_chain_sample_interval() -> u64 {
    1
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
        if let Some(v) = &self.value {
            return Ok(Some(v.clone()));
        }

        if let Some(v) = &self.file {
            return Ok(Some(fs::read_to_string(v)?.trim().to_string()));
        }

        Ok(None)
    }
}

/// This is a histogram with a bucket configuration appropriate for most things
/// which measure latency to external services.
pub const LATENCY_BUCKETS: [f64; 11] = [
    0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0,
];
