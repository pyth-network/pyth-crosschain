pub use run::RunOptions;
use {
    crate::{api::ChainId, chain::reader::BlockStatus},
    anyhow::{anyhow, Result},
    clap::{crate_authors, crate_description, crate_name, crate_version, Args, Parser},
    ethers::types::Address,
    fortuna::eth_utils::utils::EscalationPolicy,
    std::{collections::HashMap, fs},
};

mod run;

const DEFAULT_RPC_ADDR: &str = "127.0.0.1:7777";

#[derive(Parser, Debug)]
#[command(name = crate_name!())]
#[command(author = crate_authors!())]
#[command(about = crate_description!())]
#[command(version = crate_version!())]
#[allow(clippy::large_enum_variant)]
pub enum Options {
    /// Run the Argus keeper service.
    Run(RunOptions),
}

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Config Options")]
#[group(id = "Config")]
pub struct ConfigOptions {
    /// Path to a configuration file containing the list of supported blockchains
    #[arg(long = "config")]
    #[arg(env = "ARGUS_CONFIG")]
    #[arg(default_value = "config.yaml")]
    pub config: String,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Config {
    pub chains: HashMap<ChainId, EthereumConfig>,
    pub keeper: KeeperConfig,
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

    /// URL of a Geth RPC wss endpoint to use for subscribing to blockchain events.
    pub geth_rpc_wss: Option<String>,

    /// Address of a Pyth Pulse contract to interact with.
    pub contract_addr: Address,

    /// The BlockStatus of the block that is considered confirmed.
    /// For example, Finalized, Safe, Latest
    #[serde(default)]
    pub confirmed_block_status: BlockStatus,

    /// Use the legacy transaction format (for networks without EIP 1559)
    #[serde(default)]
    pub legacy_tx: bool,

    /// The gas limit to use for entropy callback transactions.
    pub gas_limit: u64,

    /// The percentage multiplier to apply to priority fee estimates (100 = no change, e.g. 150 = 150% of base fee)
    pub priority_fee_multiplier_pct: u64,

    /// The escalation policy governs how the gas limit and fee are increased during backoff retries.
    #[serde(default)]
    pub escalation_policy: EscalationPolicyConfig,

    /// How much the provider charges for a request on this chain.
    #[serde(default)]
    pub fee: u128,
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

/// Configuration values for the keeper service that are shared across chains.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct KeeperConfig {
    /// This key is used by the keeper to submit transactions for feed update requests.
    /// Must be a 20-byte (40 char) hex encoded Ethereum private key.
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
