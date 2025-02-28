use {crate::config::ConfigOptions, clap::Args, std::net::SocketAddr};

/// Run the webservice
#[derive(Args, Clone, Debug)]
pub struct RunOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Address and port the HTTP server will bind to.
    #[arg(long = "rpc-listen-addr")]
    #[arg(default_value = super::DEFAULT_RPC_ADDR)]
    #[arg(env = "RPC_ADDR")]
    pub addr: SocketAddr,

    /// Base URL for the Hermes API
    #[arg(long = "hermes-base-url")]
    #[arg(default_value = super::DEFAULT_HERMES_BASE_URL)]
    #[arg(env = "HERMES_BASE_URL")]
    pub hermes_base_url: String,
}
