use {
    crate::{
        api::ChainId,
        config::{
            ConfigOptions,
            RandomnessOptions,
        },
    },
    clap::Args,
    ethers::types::U256,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Register Provider Options")]
#[group(id = "RegisterProvider")]
pub struct RegisterProviderOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Retrieve a randomness request to this provider
    #[arg(long = "chain-id")]
    #[arg(env = "FORTUNA_CHAIN_ID")]
    pub chain_id: ChainId,

    /// A 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions (such as registering with the contract).
    #[arg(long = "private-key")]
    #[arg(env = "PRIVATE_KEY")]
    pub private_key: String,

    #[command(flatten)]
    pub randomness: RandomnessOptions,

    /// The fee to charge (in wei) for each requested random number
    #[arg(long = "pyth-contract-fee")]
    #[arg(default_value = "100")]
    pub fee: U256,

    /// The URI where clients can retrieve random values from this provider,
    /// i.e., wherever fortuna for this provider will be hosted.
    #[arg(long = "uri")]
    #[arg(default_value = "")]
    pub uri: String,
}
