use {
    crate::{
        api::ChainId,
        config::{
            ConfigOptions,
            RandomnessOptions,
        },
    },
    clap::Args,
    ethers::types::Address,
    std::net::SocketAddr,
};

/// Run the webservice
#[derive(Args, Clone, Debug)]
pub struct RunOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    #[command(flatten)]
    pub randomness: RandomnessOptions,

    // FIXME: delete this
    /// Retrieve a randomness request to this provider
    #[arg(long = "chain-id")]
    #[arg(env = "PYTH_CHAIN_ID")]
    pub chain_id: ChainId,

    /// Address and port the HTTP server will bind to.
    #[arg(long = "rpc-listen-addr")]
    #[arg(default_value = super::DEFAULT_RPC_ADDR)]
    #[arg(env = "RPC_ADDR")]
    pub addr: SocketAddr,

    /// The public key of the provider whose requests the server will respond to.
    #[arg(long = "provider")]
    #[arg(env = "PYTH_PROVIDER")]
    #[arg(default_value = "0x368397bDc956b4F23847bE244f350Bde4615F25E")]
    pub provider: Address,
}
