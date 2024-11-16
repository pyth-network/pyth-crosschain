use {clap::Args, ipnet::IpNet, std::net::SocketAddr};

const DEFAULT_RPC_LISTEN_ADDR: &str = "127.0.0.1:33999";
const DEFAULT_RPC_REQUESTER_IP_HEADER_NAME: &str = "X-Forwarded-For";

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "RPC Options")]
#[group(id = "RPC")]
pub struct Options {
    /// Address and port the RPC server will bind to.
    #[arg(long = "rpc-listen-addr")]
    #[arg(default_value = DEFAULT_RPC_LISTEN_ADDR)]
    #[arg(env = "RPC_LISTEN_ADDR")]
    pub listen_addr: SocketAddr,

    /// Whitelisted websocket ip network addresses (separated by comma).
    #[arg(long = "rpc-ws-whitelist")]
    #[arg(value_delimiter = ',')]
    #[arg(env = "RPC_WS_WHITELIST")]
    pub ws_whitelist: Vec<IpNet>,

    /// Header name (case insensitive) to fetch requester IP from.
    #[arg(long = "rpc-requester-ip-header-name")]
    #[arg(default_value = DEFAULT_RPC_REQUESTER_IP_HEADER_NAME)]
    #[arg(env = "RPC_REQUESTER_IP_HEADER_NAME")]
    pub requester_ip_header_name: String,
}
