use {clap::Args, solana_sdk::pubkey::Pubkey};

const DEFAULT_CONTRACT_ADDR: &str = "H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU";

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Wormhole Options")]
#[group(id = "Wormhole")]
pub struct Options {
    /// Address of the Wormhole contract on the target PythNet cluster.
    #[arg(long = "wormhole-contract-addr")]
    #[arg(default_value = DEFAULT_CONTRACT_ADDR)]
    #[arg(env = "WORMHOLE_CONTRACT_ADDR")]
    pub contract_addr: Pubkey,

    /// gRPC endpoint for a Wormhole spy.
    ///
    /// This can either be a standard Wormhole spy gRPC endpoint or a beacon endpoint if
    /// load-balancing is desired.
    #[arg(long = "wormhole-spy-rpc-addr")]
    #[arg(env = "WORMHOLE_SPY_RPC_ADDR")]
    pub spy_rpc_addr: String,
}
