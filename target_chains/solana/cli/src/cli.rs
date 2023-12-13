use {
    clap::{
        Parser,
        Subcommand,
    },
    solana_sdk::pubkey::Pubkey,
    std::str::FromStr,
};

#[derive(Parser, Debug)]
#[clap(
    about = "A cli for the solana receiver contract",
    author = "Pyth Network Contributors"
)]
pub struct Cli {
    #[clap(
        short = 'k',
        long,
        default_value = "~/.config/solana/id.json",
        help = "Keypair of the payer of transactions"
    )]
    pub keypair:  String,
    #[clap(
        short = 'u',
        long,
        default_value = "http://localhost:8899",
        help = "RPC endpoint of the solana"
    )]
    pub url:      String,
    #[clap(short = 'w', long, parse(try_from_str = Pubkey::from_str), help = "Address of the wormhole contract")]
    pub wormhole: Pubkey,
    #[clap(subcommand)]
    pub action:   Action,
}

#[derive(Subcommand, Debug)]
pub enum Action {
    #[clap(about = "Verify, post and receive the price VAA on solana")]
    PostAndReceiveVAA {
        #[clap(short = 'v', long, help = "Price VAA from Pythnet")]
        vaa: String,
    },
    #[clap(
        about = "Initialize a wormhole receiver contract by sequentially replaying the guardian set updates"
    )]
    InitializeWormholeReceiver {},
}
