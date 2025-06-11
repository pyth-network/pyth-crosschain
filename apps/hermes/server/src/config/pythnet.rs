use {clap::Args, solana_sdk::pubkey::Pubkey};

const DEFAULT_PYTHNET_ORACLE_PROGRAM_ADDR: &str = "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH";

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Pythnet Options")]
#[group(id = "Pythnet")]
pub struct Options {
    /// Address of a PythNet compatible websocket RPC endpoint.
    #[arg(long = "pythnet-ws-addr")]
    #[arg(env = "PYTHNET_WS_ADDR")]
    pub ws_addr: String,

    /// Address of a PythNet compatible HTP RPC endpoint.
    #[arg(long = "pythnet-http-addr")]
    #[arg(env = "PYTHNET_HTTP_ADDR")]
    pub http_addr: String,

    /// Pythnet oracle program address.
    #[arg(long = "pythnet-oracle-program-addr")]
    #[arg(default_value = DEFAULT_PYTHNET_ORACLE_PROGRAM_ADDR)]
    #[arg(env = "PYTHNET_ORACLE_PROGRAM_ADDR")]
    pub oracle_program_addr: Pubkey,

    /// Address of a PythNet quorum websocket RPC endpoint.
    #[arg(long = "pythnet-quorum-ws-addr")]
    #[arg(env = "PYTHNET_QUORUM_WS_ADDR")]
    pub quorum_ws_addr: Option<String>,
}
