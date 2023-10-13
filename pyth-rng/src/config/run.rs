use clap::Args;
use std::net::SocketAddr;
use crate::config::{EthereumOptions, RandomnessOptions};

const DEFAULT_RPC_ADDR: &str = "127.0.0.1:34000";

#[derive(Args, Clone, Debug)]
pub struct RunOptions {
    #[command(flatten)]
    pub ethereum: EthereumOptions,

    #[command(flatten)]
    pub randomness: RandomnessOptions,

    /// Address and port the HTTP server will bind to.
    #[arg(long = "rpc-listen-addr")]
    #[arg(default_value = DEFAULT_RPC_ADDR)]
    #[arg(env = "RPC_ADDR")]
    pub addr: SocketAddr,
}
