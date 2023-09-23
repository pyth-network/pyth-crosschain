use {
    clap::Args,
    libp2p::Multiaddr,
    solana_sdk::pubkey::Pubkey,
};

const DEFAULT_LISTEN_ADDRS: &str = "/ip4/0.0.0.0/udp/30910/quic,/ip6/::/udp/30910/quic";
const DEFAULT_CONTRACT_ADDR: &str = "H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU";
const DEFAULT_NETWORK_ID: &str = "/wormhole/mainnet/2";
const DEFAULT_BOOTSTRAP_ADDRS: &str = concat![
    "/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7,",
    "/dns4/wormhole-v2-mainnet-bootstrap.xlabs.xyz/udp/8999/quic/p2p/12D3KooWNQ9tVrcb64tw6bNs2CaNrUGPM7yRrKvBBheQ5yCyPHKC",
];

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Wormhole Options")]
#[group(id = "Wormhole")]
pub struct Options {
    /// Multiaddresses for Wormhole bootstrap peers (separated by comma).
    ///
    /// Bootstraps can be found from the official Wormhole repository, note that these addresses
    /// are only used to bootstrap peer discovery and are not necessarily used for data transfer.
    /// Adding more peers will speed up P2P peer discovery.
    #[arg(long = "wormhole-bootstrap-addrs")]
    #[arg(value_delimiter = ',')]
    #[arg(default_value = DEFAULT_BOOTSTRAP_ADDRS)]
    #[arg(env = "WORMHOLE_BOOTSTRAP_ADDRS")]
    pub bootstrap_addrs: Vec<Multiaddr>,

    /// Address of the Wormhole contract on the target PythNet cluster.
    #[arg(long = "wormhole-contract-addr")]
    #[arg(default_value = DEFAULT_CONTRACT_ADDR)]
    #[arg(env = "WORMHOLE_CONTRACT_ADDR")]
    pub contract_addr: Pubkey,

    /// Multiaddresses to bind for Wormhole P2P (separated by comma)
    #[arg(long = "wormhole-listen-addrs")]
    #[arg(value_delimiter = ',')]
    #[arg(default_value = DEFAULT_LISTEN_ADDRS)]
    #[arg(env = "WORMHOLE_LISTEN_ADDRS")]
    pub listen_addrs: Vec<Multiaddr>,

    /// Network ID for Wormhole
    #[arg(long = "wormhole-network-id")]
    #[arg(default_value = DEFAULT_NETWORK_ID)]
    #[arg(env = "WORMHOLE_NETWORK_ID")]
    pub network_id: String,
}
