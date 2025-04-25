use {
    crate::{api::ChainId, config::ConfigOptions},
    clap::Args,
    ethers::types::Address,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Generate Options")]
#[group(id = "Generate")]
pub struct GenerateOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// The chain on which to submit the random number generation request.
    #[arg(long = "chain-id")]
    #[arg(env = "FORTUNA_CHAIN_ID")]
    pub chain_id: ChainId,

    /// A 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions (such as registering with the contract).
    #[arg(long = "private-key")]
    #[arg(env = "PRIVATE_KEY")]
    #[arg(default_value = None)]
    pub private_key: String,

    /// Submit a randomness request to this provider
    #[arg(long = "provider")]
    pub provider: Address,
}
