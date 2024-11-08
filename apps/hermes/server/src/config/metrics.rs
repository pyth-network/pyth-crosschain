use {clap::Args, std::net::SocketAddr};

const DEFAULT_METRICS_SERVER_LISTEN_ADDR: &str = "127.0.0.1:33888";

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Metrics Options")]
#[group(id = "Metrics")]
pub struct Options {
    /// Address and port the RPC server will bind to.
    #[arg(long = "metrics-server-listen-addr")]
    #[arg(default_value = DEFAULT_METRICS_SERVER_LISTEN_ADDR)]
    #[arg(env = "METRICS_SERVER_LISTEN_ADDR")]
    pub server_listen_addr: SocketAddr,
}
