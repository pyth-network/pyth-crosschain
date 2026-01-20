use {clap::Args, solana_sdk::pubkey::Pubkey, std::str::FromStr};

const DEFAULT_CONTRACT_ADDR: &str = "H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU";
const DEFAULT_ETHEREUM_CONTRACT_ADDR: &str = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B";

/// Source from which to fetch the Wormhole guardian set.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum GuardianSetSource {
    /// Fetch guardian set from Pythnet (default, backward compatible).
    #[default]
    Pythnet,
    /// Fetch guardian set from Ethereum mainnet.
    Ethereum,
}

impl FromStr for GuardianSetSource {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pythnet" => Ok(GuardianSetSource::Pythnet),
            "ethereum" => Ok(GuardianSetSource::Ethereum),
            _ => Err(format!(
                "Invalid guardian set source: '{s}'. Must be 'pythnet' or 'ethereum'."
            )),
        }
    }
}

impl std::fmt::Display for GuardianSetSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GuardianSetSource::Pythnet => write!(f, "pythnet"),
            GuardianSetSource::Ethereum => write!(f, "ethereum"),
        }
    }
}

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

    /// Source from which to fetch the Wormhole guardian set.
    ///
    /// Options: 'pythnet' (default) or 'ethereum'.
    /// When set to 'ethereum', the guardian set will be fetched from an Ethereum
    /// RPC endpoint instead of Pythnet.
    #[arg(long = "wormhole-guardian-set-source")]
    #[arg(default_value = "pythnet")]
    #[arg(env = "WORMHOLE_GUARDIAN_SET_SOURCE")]
    pub guardian_set_source: GuardianSetSource,

    /// Ethereum RPC endpoint for fetching guardian set.
    ///
    /// Required when --wormhole-guardian-set-source is set to 'ethereum'.
    /// Should be a valid Ethereum mainnet HTTP RPC endpoint.
    #[arg(long = "wormhole-ethereum-rpc-addr")]
    #[arg(env = "WORMHOLE_ETHEREUM_RPC_ADDR")]
    pub ethereum_rpc_addr: Option<String>,

    /// Address of the Wormhole contract on Ethereum mainnet.
    ///
    /// Only used when --wormhole-guardian-set-source is set to 'ethereum'.
    #[arg(long = "wormhole-ethereum-contract-addr")]
    #[arg(default_value = DEFAULT_ETHEREUM_CONTRACT_ADDR)]
    #[arg(env = "WORMHOLE_ETHEREUM_CONTRACT_ADDR")]
    pub ethereum_contract_addr: String,
}
