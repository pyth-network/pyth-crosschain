use clap::Args;

const DEFAULT_CONTRACT_ADDR: &str = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B";

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Wormhole Options")]
#[group(id = "Wormhole")]
pub struct Options {
    /// Address of the Wormhole contract on the target PythNet cluster.
    #[arg(long = "wormhole-contract-addr")]
    #[arg(default_value = DEFAULT_CONTRACT_ADDR)]
    #[arg(env = "WORMHOLE_CONTRACT_ADDR")]
    pub contract_addr: String,

    /// gRPC endpoint for a Wormhole spy.
    ///
    /// This can either be a standard Wormhole spy gRPC endpoint or a beacon endpoint if
    /// load-balancing is desired.
    #[arg(long = "wormhole-spy-rpc-addr")]
    #[arg(env = "WORMHOLE_SPY_RPC_ADDR")]
    pub spy_rpc_addr: String,

    /// Ethereum RPC endpoint for fetching the Wormhole guardian set.
    ///
    /// Should be a valid Ethereum mainnet HTTP RPC endpoint.
    #[arg(long = "wormhole-ethereum-rpc-addr")]
    #[arg(env = "WORMHOLE_ETHEREUM_RPC_ADDR")]
    pub ethereum_rpc_addr: String,
}
