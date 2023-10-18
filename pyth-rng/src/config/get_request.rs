use {
    crate::config::EthereumOptions,
    clap::Args,
    ethers::types::Address,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Get Request Options")]
#[group(id = "GetRequest")]
pub struct GetRequestOptions {
    #[command(flatten)]
    pub ethereum: EthereumOptions,

    /// Retrieve a randomness request to this provider
    #[arg(long = "provider")]
    #[arg(env = "PYTH_PROVIDER")]
    #[arg(default_value = "0x368397bDc956b4F23847bE244f350Bde4615F25E")]
    pub provider: Address,

    /// The sequence number of the request to retrieve
    #[arg(long = "sequence")]
    #[arg(env = "PYTH_SEQUENCE")]
    #[arg(default_value = "0")]
    pub sequence: u64,
}
