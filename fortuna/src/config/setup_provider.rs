use {
    crate::config::{
        ConfigOptions,
        RandomnessOptions,
    },
    anyhow::Result,
    clap::Args,
    std::fs,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Setup Provider Options")]
#[group(id = "SetupProviderOptions")]
pub struct SetupProviderOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Path to a file containing a 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions (such as registering with the contract).
    #[arg(long = "private-key")]
    #[arg(env = "PRIVATE_KEY")]
    pub private_key_file: String,

    #[command(flatten)]
    pub randomness: RandomnessOptions,

    /// The fee to charge (in wei) for each requested random number
    #[arg(long = "pyth-contract-fee")]
    #[arg(default_value = "100")]
    pub fee: u128,

    /// The base URI for fortuna without ending slashes.
    /// e.g., https://fortuna-staging.pyth.network
    #[arg(long = "uri")]
    pub base_uri: String,
}

impl SetupProviderOptions {
    pub fn load_private_key(&self) -> Result<String> {
        return Ok((fs::read_to_string(&self.private_key_file))?);
    }
}
