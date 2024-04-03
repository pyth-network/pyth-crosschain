use {
    crate::config::{
        ConfigOptions,
        RandomnessOptions,
    },
    anyhow::Result,
    clap::Args,
    ethers::types::Address,
    std::{
        fs,
        net::SocketAddr,
    },
};

/// Run the webservice
#[derive(Args, Clone, Debug)]
pub struct RunOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    #[command(flatten)]
    pub randomness: RandomnessOptions,

    /// Address and port the HTTP server will bind to.
    #[arg(long = "rpc-listen-addr")]
    #[arg(default_value = super::DEFAULT_RPC_ADDR)]
    #[arg(env = "RPC_ADDR")]
    pub addr: SocketAddr,

    /// The public key of the provider whose requests the server will respond to.
    #[arg(long = "provider")]
    #[arg(env = "FORTUNA_PROVIDER")]
    pub provider: Address,

    /// Path to a file containing a 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions for entropy callback requests.
    /// This key should not be a registered provider.
    #[arg(long = "keeper-private-key")]
    #[arg(env = "KEEPER_PRIVATE_KEY")]
    pub keeper_private_key_file: String,
}

impl RunOptions {
    pub fn load_private_key(&self) -> Result<String> {
        return Ok((fs::read_to_string(&self.keeper_private_key_file))?);
    }
}
