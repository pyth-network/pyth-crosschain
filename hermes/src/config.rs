use {
    libp2p::Multiaddr,
    reqwest::Url,
    solana_sdk::pubkey::Pubkey,
    std::net::SocketAddr,
    structopt::StructOpt,
};

const DEFAULT_NETWORK_ID: &str = "/wormhole/mainnet/2";
const DEFAULT_WORMHOLE_BOOTSTRAP_ADDRS: &str = "/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7,/dns4/wormhole-v2-mainnet-bootstrap.xlabs.xyz/udp/8999/quic/p2p/12D3KooWNQ9tVrcb64tw6bNs2CaNrUGPM7yRrKvBBheQ5yCyPHKC";
const DEFAULT_WORMHOLE_LISTEN_ADDRS: &str = "/ip4/0.0.0.0/udp/30910/quic,/ip6/::/udp/30910/quic";
const DEFAULT_API_ADDR: &str = "127.0.0.1:33999";

/// `Options` is a structup definition to provide clean command-line args for Hermes.
#[derive(StructOpt, Debug)]
#[structopt(name = "hermes", about = "Hermes")]
pub enum Options {
    /// Run the hermes service.
    Run(RunOptions),
}

#[derive(Clone, Debug, StructOpt)]
pub struct RunOptions {
    /// Wormhole Options.
    #[structopt(flatten)]
    pub wormhole: WormholeOptions,

    /// PythNet Options
    #[structopt(flatten)]
    pub pythnet: PythNetOptions,

    /// RPC Options
    #[structopt(flatten)]
    pub rpc: RpcOptions,

    /// Benchmarks Options
    #[structopt(flatten)]
    pub benchmarks: BenchmarksOptions,
}

#[derive(Clone, Debug, StructOpt)]
pub struct WormholeOptions {
    /// Multiaddresses for Wormhole bootstrap peers (separated by comma).
    #[structopt(long)]
    #[structopt(use_delimiter = true)]
    #[structopt(default_value = DEFAULT_WORMHOLE_BOOTSTRAP_ADDRS)]
    #[structopt(env = "WORMHOLE_BOOTSTRAP_ADDRS")]
    pub bootstrap_addrs: Vec<Multiaddr>,

    /// Address of the Wormhole contract on the target PythNet cluster.
    #[structopt(long)]
    #[structopt(default_value = "H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU")]
    #[structopt(env = "WORMHOLE_CONTRACT_ADDR")]
    pub contract_addr: Pubkey,

    /// Multiaddresses to bind Wormhole P2P to (separated by comma)
    #[structopt(long)]
    #[structopt(use_delimiter = true)]
    #[structopt(default_value = DEFAULT_WORMHOLE_LISTEN_ADDRS)]
    #[structopt(env = "WORMHOLE_LISTEN_ADDRS")]
    pub listen_addrs: Vec<Multiaddr>,

    /// Network ID for Wormhole
    #[structopt(long)]
    #[structopt(default_value = DEFAULT_NETWORK_ID)]
    #[structopt(env = "WORMHOLE_NETWORK_ID")]
    pub network_id: String,
}

#[derive(Clone, Debug, StructOpt)]
pub struct PythNetOptions {
    /// Address of a PythNet compatible websocket RPC endpoint.
    #[structopt(long)]
    #[structopt(env = "PYTHNET_WS_ENDPOINT")]
    pub ws_endpoint: String,

    /// Addres of a PythNet compatible HTP RPC endpoint.
    #[structopt(long)]
    #[structopt(env = "PYTHNET_HTTP_ENDPOINT")]
    pub http_endpoint: String,
}

#[derive(Clone, Debug, StructOpt)]
pub struct RpcOptions {
    /// Address to bind the API server to.
    #[structopt(long)]
    #[structopt(default_value = DEFAULT_API_ADDR)]
    #[structopt(env = "API_ADDR")]
    pub addr: SocketAddr,
}

#[derive(Clone, Debug, StructOpt)]
pub struct BenchmarksOptions {
    /// Benchmarks endpoint to retrieve historical update data from.
    #[structopt(long)]
    #[structopt(env = "BENCHMARKS_ENDPOINT")]
    pub endpoint: Option<Url>,
}
