use {
    crate::{api::ChainId, config::ConfigOptions},
    clap::Args,
    ethers::types::Address,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Get Request Options")]
#[group(id = "GetRequest")]
pub struct GetRequestOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Retrieve a randomness request to this provider
    #[arg(long = "chain-id")]
    #[arg(env = "FORTUNA_CHAIN_ID")]
    pub chain_id: ChainId,

    /// Retrieve a randomness request to this provider
    #[arg(long = "provider")]
    #[arg(env = "FORTUNA_PROVIDER")]
    pub provider: Address,

    /// The sequence number of the request to retrieve
    #[arg(long = "sequence")]
    #[arg(env = "FORTUNA_SEQUENCE")]
    #[arg(default_value = "0")]
    pub sequence: u64,
}
