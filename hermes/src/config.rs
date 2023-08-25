use {
    libp2p::Multiaddr,
    reqwest::Url,
    solana_sdk::pubkey::Pubkey,
    std::net::SocketAddr,
    structopt::StructOpt,
};

const DEFAULT_NETWORK_ID: &str = "/wormhole/mainnet/2";
const DEFAULT_WORMHOLE_BOOTSTRAP_ADDRS: &str = "/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7";
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
    /// The address to bind the API server to.
    #[structopt(long)]
    #[structopt(default_value = DEFAULT_API_ADDR)]
    #[structopt(env = "API_ADDR")]
    pub api_addr: SocketAddr,

    /// Address of a PythNet compatible websocket RPC endpoint.
    #[structopt(long)]
    #[structopt(env = "PYTHNET_WS_ENDPOINT")]
    pub pythnet_ws_endpoint: String,

    /// Addres of a PythNet compatible HTP RPC endpoint.
    #[structopt(long)]
    #[structopt(env = "PYTHNET_HTTP_ENDPOINT")]
    pub pythnet_http_endpoint: String,

    /// Multiaddresses for Wormhole bootstrap peers (separated by comma).
    #[structopt(long)]
    #[structopt(use_delimiter = true)]
    #[structopt(default_value = DEFAULT_WORMHOLE_BOOTSTRAP_ADDRS)]
    #[structopt(env = "WORMHOLE_BOOTSTRAP_ADDRS")]
    pub wh_bootstrap_addrs: Vec<Multiaddr>,

    /// Address of the Wormhole contract on the target PythNet cluster.
    #[structopt(long)]
    #[structopt(default_value = "H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU")]
    #[structopt(env = "WORMHOLE_CONTRACT_ADDR")]
    pub wh_contract_addr: Pubkey,

    /// Multiaddresses to bind Wormhole P2P to (separated by comma)
    #[structopt(long)]
    #[structopt(use_delimiter = true)]
    #[structopt(default_value = DEFAULT_WORMHOLE_LISTEN_ADDRS)]
    #[structopt(env = "WORMHOLE_LISTEN_ADDRS")]
    pub wh_listen_addrs: Vec<Multiaddr>,

    /// Network ID for Wormhole
    #[structopt(long)]
    #[structopt(default_value = DEFAULT_NETWORK_ID)]
    #[structopt(env = "WORMHOLE_NETWORK_ID")]
    pub wh_network_id: String,

    /// Benchmarks endpoint to retrieve historical update data from.
    #[structopt(long)]
    #[structopt(env = "BENCHMARKS_ENDPOINT")]
    pub benchmarks_endpoint: Option<Url>,
}
