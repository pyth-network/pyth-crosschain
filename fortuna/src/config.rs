use {
    crate::{
        api::ChainId,
        chain::reader::BlockNumber,
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
    regex::{
        Captures,
        Regex,
    },
    std::{
        collections::HashMap,
        env,
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
    #[arg(default_value = "10000")]
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
        let config: Config = serde_yaml::from_str(&Config::inject_env(&yaml_content)?)?;
        Ok(config)
    }

    pub fn get_chain_config(&self, chain_id: &ChainId) -> Result<EthereumConfig> {
        self.chains
            .get(chain_id)
            .map(|x| x.clone())
            .ok_or(anyhow!("Could not find chain id {} in the configuration", &chain_id).into())
    }

    // Inject environment variables in the given string. 
    // It will replace substrings that matches the pattern ${VAR_NAME} with an 
    // environment variable VAR_NAME. If there is no such env var, it will return 
    // an error.
    fn inject_env(yaml_content: &str) -> Result<String> {
        let re = Regex::new(r"\$\{([a-zA-Z_][0-9a-zA-Z_]*)\}").unwrap();
        let mut var_error: Option<env::VarError> = None;
        let new_yaml_content =
            re.replace_all(&yaml_content, |caps: &Captures| match env::var(&caps[1]) {
                Ok(val) => val,
                Err(err) => {
                    var_error = Some(err);
                    (&caps[0]).to_string()
                }
            });

        if let Some(error) = var_error {
            Err(anyhow!("{}", error))
        } else {
            Ok(new_yaml_content.to_string())
        }
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct EthereumConfig {
    /// URL of a Geth RPC endpoint to use for interacting with the blockchain.
    pub geth_rpc_addr: String,

    /// Address of a Pyth Randomness contract to interact with.
    pub contract_addr: Address,

    /// How many blocks to wait before revealing the random number.
    pub reveal_delay_blocks: BlockNumber,

    /// Use the legacy transaction format (for networks without EIP 1559)
    #[serde(default)]
    pub legacy_tx: bool,
}
