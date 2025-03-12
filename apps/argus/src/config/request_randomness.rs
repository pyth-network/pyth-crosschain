use {
    crate::{api::ChainId, config::ConfigOptions},
    clap::Args,
    ethers::types::Address,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Request Randomness Options")]
#[group(id = "RequestRandomness")]
pub struct RequestRandomnessOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Request randomness on this blockchain.
    #[arg(long = "chain-id")]
    #[arg(env = "FORTUNA_CHAIN_ID")]
    pub chain_id: ChainId,

    /// A 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions (such as registering with the contract).
    #[arg(long = "private-key")]
    #[arg(env = "PRIVATE_KEY")]
    pub private_key: String,

    /// Submit a randomness request to this provider
    #[arg(long = "provider")]
    #[arg(env = "FORTUNA_PROVIDER")]
    pub provider: Address,
}
