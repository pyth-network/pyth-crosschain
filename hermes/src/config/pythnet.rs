use clap::Args;

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Pythnet Options")]
#[group(id = "Pythnet")]
pub struct Options {
    /// Address of a PythNet compatible websocket RPC endpoint.
    #[arg(long = "pythnet-ws-addr")]
    #[arg(env = "PYTHNET_WS_ENDPOINT")]
    pub ws_endpoint: String,

    /// Addres of a PythNet compatible HTP RPC endpoint.
    #[arg(long = "pythnet-http-addr")]
    #[arg(env = "PYTHNET_HTTP_ENDPOINT")]
    pub http_endpoint: String,
}
