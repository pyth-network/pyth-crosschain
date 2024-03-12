use {
    crate::config::{
        ConfigOptions,
        RandomnessOptions,
    },
    anyhow::Result,
    clap::Args,
    ethers::types::Address,
    std::fs,
};

/// Run the webservice
#[derive(Args, Clone, Debug)]
pub struct RunKeeperOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    #[command(flatten)]
    pub randomness: RandomnessOptions,

    /// Path to a file containing a 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions (such as registering with the contract).
    #[arg(long = "private-key")]
    #[arg(env = "PRIVATE_KEY")]
    pub private_key_file: String,
}

impl RunKeeperOptions {
    pub fn load_private_key(&self) -> Result<String> {
        return Ok((fs::read_to_string(&self.private_key_file))?);
    }
}
