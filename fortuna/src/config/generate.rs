use {
    crate::{
        api::ChainId,
        config::ConfigOptions,
    },
    clap::Args,
    ethers::types::Address,
    reqwest::Url,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Generate Options")]
#[group(id = "Generate")]
pub struct GenerateOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Retrieve a randomness request to this provider
    #[arg(long = "chain-id")]
    #[arg(env = "PYTH_CHAIN_ID")]
    pub chain_id: ChainId,

    /// A 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions (such as registering with the contract).
    #[arg(long = "private-key")]
    #[arg(env = "PRIVATE_KEY")]
    #[arg(default_value = None)]
    pub private_key: String,

    /// Submit a randomness request to this provider
    #[arg(long = "provider")]
    #[arg(default_value = "0x368397bDc956b4F23847bE244f350Bde4615F25E")]
    pub provider: Address,

    #[arg(long = "url")]
    #[arg(default_value = super::DEFAULT_HTTP_ADDR)]
    pub url: Url,

    #[arg(short = 'b')]
    pub blockhash: bool,
}
