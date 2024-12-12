use {clap::Args, solana_sdk::pubkey::Pubkey};

const DEFAULT_PYTHNET_MAPPING_ADDR: &str = "AHtgzX45WTKfkPG53L6WYhGEXwQkN1BVknET3sVsLL8J";

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

    /// Pyth mapping account address on Pythnet.
    #[arg(long = "pythnet-mapping-addr")]
    #[arg(default_value = DEFAULT_PYTHNET_MAPPING_ADDR)]
    #[arg(env = "PYTHNET_MAPPING_ADDR")]
    pub mapping_addr: Pubkey,
}
