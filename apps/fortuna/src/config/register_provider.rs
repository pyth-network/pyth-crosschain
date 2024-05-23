use {
    crate::{
        api::ChainId,
        config::{
            ConfigOptions,
            RandomnessOptions,
        },
    },
    clap::Args,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Register Provider Options")]
#[group(id = "RegisterProvider")]
pub struct RegisterProviderOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Register the provider on this chain
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
}
