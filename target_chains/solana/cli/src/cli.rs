//! CLI options
use {
    clap::{
        Parser,
        Subcommand,
    },
};

#[derive(Parser, Debug)]
#[clap(
    about = "A cli for the solana receiver contract",
    author = "Pyth Network Contributors"
)]
pub struct Cli {
    #[clap(subcommand)]
    pub action:     Action,
}

#[derive(Subcommand, Debug)]
pub enum Action {
    #[clap(about = "Verify and post the price VAA on solana")]
    PostPriceVAA {
        #[clap(short = 'v', long,
               help = "Price VAA from Pythnet")]
        vaa:     String,
        #[clap(
            short = 'k', long,
            default_value = "~/.config/solana/id.json",
            help = "Keypair of the transaction's funder"
        )]
        keypair: String,
    },

    #[clap(about = "Invoke the on-chain contract decoding the VAA")]
    InvokePriceReceiver {
        #[clap(
            short = 'k', long,
            default_value = "~/.config/solana/id.json",
            help = "Keypair of the transaction's funder"
        )]
        keypair: String,
    },
}
