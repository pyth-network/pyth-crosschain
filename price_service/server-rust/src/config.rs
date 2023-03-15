use {
    libp2p::Multiaddr,
    std::{
        net::SocketAddr,
        path::PathBuf,
    },
    structopt::StructOpt,
};

/// StructOpt definitions that provides the following arguments and commands:
///
/// Some of these arguments are not currently used, but are included for future use to guide the
/// structure of the application.
#[derive(StructOpt, Debug)]
#[structopt(name = "pythnet", about = "PythNet")]
pub enum Options {
    /// Run the PythNet P2P service.
    Run {
        /// A Path to a protobuf encoded ed25519 private key.
        #[structopt(short, long)]
        id: Option<PathBuf>,

        /// A Path to a protobuf encoded secp256k1 private key.
        #[structopt(long)]
        id_secp256k1: Option<PathBuf>,

        /// Multiaddress for a Wormhole bootstrap peer.
        #[structopt(long)]
        wormhole_peer: Option<String>,

        /// Multiaddress to bind Wormhole P2P to.
        #[structopt(long)]
        wormhole_addr: Option<Multiaddr>,

        /// The address to bind the RPC server to.
        #[structopt(long, default_value = "127.0.0.1:33999")]
        rpc_addr: SocketAddr,

        /// Multiaddress to bind Pyth P2P server to.
        #[structopt(long, default_value = "/ip4/127.0.0.1/tcp/34000")]
        p2p_addr: Multiaddr,

        /// A bootstrapping peer to join the cluster.
        #[allow(dead_code)]
        #[structopt(long)]
        p2p_peer: Vec<SocketAddr>,
    },

    /// Generate a new keypair.
    Keygen {
        /// The path to write the generated key to.
        #[structopt(short, long)]
        output: PathBuf,
    },
}
