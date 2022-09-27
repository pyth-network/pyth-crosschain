//! CLI options
use remote_executor;
use clap::{
    Parser,
    Subcommand,
};
use solana_sdk::commitment_config::CommitmentConfig;
use solana_program::pubkey::Pubkey;
use wormhole_solana;

#[derive(Parser, Debug)]
#[clap(
    about = "A cli for the remote executor",
    author = "Pyth Network Contributors"
)]
pub struct Cli {
    #[clap(subcommand)]
    pub action: Action,
    #[clap(long, default_value = "confirmed")]
    pub commitment: CommitmentConfig,
    #[clap(
        short = 'k',
        long = "keypair",
        default_value = "~/.config/solana/id.json",
        help = "Keypair file the funder of the transaction"
    )]
    pub keypair: String,
}

#[derive(Subcommand, Debug)]
pub enum Action {
    #[clap(about = "Post a VAA and execute it through the remote executor")]
    PostAndExecute {
        #[clap(
            short = 'v',
            long = "vaa",
        )]
        vaa : String
    },
    #[clap(about = "Send test VAA from solana")]
    SendTestVAA {

    }
}
