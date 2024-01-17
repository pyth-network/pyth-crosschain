use {
    crate::{
        api::ChainId,
        config::{
            ConfigOptions,
            RandomnessOptions,
        },
    },
    clap::Args,
    std::fs,
    anyhow::Result,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Register Provider On All Options")]
#[group(id = "RegisterProviderOnAll")]
pub struct RegisterProviderOnAllOptions {
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

    /// The URI where clients can retrieve random values from this provider,
    /// i.e., wherever fortuna for this provider will be hosted.
    #[arg(long = "uri")]
    #[arg(default_value = "")]
    pub uri: String,
}

impl RegisterProviderOnAllOptions {
    pub fn load_private_key(&self) -> Result<String> {
        return Ok((fs::read_to_string(&self.private_key_file))?);
    }
}
