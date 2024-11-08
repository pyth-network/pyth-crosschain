//! CLI options
use {
    clap::Parser,
    solana_sdk::{
        pubkey::Pubkey,
        signature::{read_keypair_file, Keypair},
    },
};

#[derive(Parser, Debug)]
#[clap(
    about = "A cli for the remote executor",
    author = "Pyth Network Contributors"
)]
pub struct Cli {
    #[clap(long, default_value = "https://pythnet.rpcpool.com/")]
    pub rpc_url: String,
    #[clap(
        long,
        default_value = "~/.config/solana/id.json",
        help = "Keypair file the funder of the transaction",
        parse(try_from_str = get_keypair_from_file)
    )]
    pub keypair: Keypair,
    #[clap(long, help = "M parameter")]
    pub m: u64,
    #[clap(long, help = "Z parameter")]
    pub z: u64,
    #[clap(long, help = "Update authority for the parameters")]
    pub authority: Pubkey,
}

fn get_keypair_from_file(path: &str) -> Result<Keypair, String> {
    read_keypair_file(&*shellexpand::tilde(&path))
        .map_err(|_| format!("Keypair not found: {}", path))
}
