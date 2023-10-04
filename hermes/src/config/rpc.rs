use {
    clap::Args,
    ipnet::IpNet,
    std::net::SocketAddr,
};

const DEFAULT_RPC_ADDR: &str = "127.0.0.1:33999";

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "RPC Options")]
#[group(id = "RPC")]
pub struct Options {
    /// Address and port the RPC server will bind to.
    #[arg(long = "rpc-listen-addr")]
    #[arg(default_value = DEFAULT_RPC_ADDR)]
    #[arg(env = "RPC_ADDR")]
    pub addr: SocketAddr,

    /// Whitelisted websocket ip network addresses (separated by comma).
    #[arg(long = "rpc-ws-whitelist")]
    #[arg(value_delimiter = ',')]
    #[arg(env = "RPC_WS_WHITELIST")]
    pub ws_whitelist: Vec<IpNet>,
}
