use {
    crate::config::{
        ConfigOptions,
        ProviderConfigOptions,
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
    pub provider_config: ProviderConfigOptions,

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

    /// If provided, the keeper will run alongside the Fortuna API service.
    /// It should be a path to a file containing a 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions for entropy callback requests.
    /// This key should not be a registered provider.
    #[arg(long = "keeper-private-key")]
    #[arg(env = "KEEPER_PRIVATE_KEY")]
    pub keeper_private_key_file: Option<String>,
}

impl RunOptions {
    pub fn load_keeper_private_key(&self) -> Result<Option<String>> {
        if let Some(ref keeper_private_key_file) = self.keeper_private_key_file {
            return Ok(Some(fs::read_to_string(keeper_private_key_file)?));
        }
        return Ok(None);
    }
}
