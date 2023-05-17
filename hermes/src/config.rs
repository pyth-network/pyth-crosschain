use {
    libp2p::Multiaddr,
    std::net::SocketAddr,
    structopt::StructOpt,
};

/// StructOpt definitions that provides the following arguments and commands:
///
/// Some of these arguments are not currently used, but are included for future use to guide the
/// structure of the application.
#[derive(StructOpt, Debug)]
#[structopt(name = "hermes", about = "Hermes")]
pub enum Options {
    Run {
        #[structopt(long, env = "PYTHNET_WS_ENDPOINT")]
        pythnet_ws_endpoint: String,

        /// Network ID for Wormhole
        #[structopt(
            long,
            default_value = "/wormhole/mainnet/2",
            env = "WORMHOLE_NETWORK_ID"
        )]
        wh_network_id: String,

        /// Multiaddresses for Wormhole bootstrap peers (separated by comma).
        #[structopt(
            long,
            use_delimiter = true,
            default_value = "/dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWQp644DK27fd3d4Km3jr7gHiuJJ5ZGmy8hH4py7fP4FP7",
            env = "WORMHOLE_BOOTSTRAP_ADDRS"
        )]
        wh_bootstrap_addrs: Vec<Multiaddr>,

        /// Multiaddresses to bind Wormhole P2P to (separated by comma)
        #[structopt(
            long,
            use_delimiter = true,
            default_value = "/ip4/0.0.0.0/udp/30910/quic,/ip6/::/udp/30910/quic",
            env = "WORMHOLE_LISTEN_ADDRS"
        )]
        wh_listen_addrs: Vec<Multiaddr>,

        /// The address to bind the API server to.
        #[structopt(long, default_value = "127.0.0.1:33999")]
        api_addr: SocketAddr,
    },
}
