//! CLI options
use {
    clap::{
        Parser,
        Subcommand,
    },
    solana_sdk::{
        commitment_config::CommitmentConfig,
        pubkey::Pubkey,
    },
};

#[derive(Parser, Debug)]
#[clap(
    about = "A cli for the remote executor",
    author = "Pyth Network Contributors"
)]
pub struct Cli {
    #[clap(long, default_value = "confirmed")]
    pub commitment: CommitmentConfig,
    #[clap(subcommand)]
    pub action:     Action,
}

#[derive(Subcommand, Debug)]
pub enum Action {
    #[clap(about = "Post a VAA and execute it through the remote executor")]
    PostAndExecute {
        #[clap(short = 'v', long = "vaa")]
        vaa:     String,
        #[clap(
            long,
            default_value = "~/.config/solana/id.json",
            help = "Keypair file the funder of the transaction"
        )]
        keypair: String,
    },
    #[clap(about = "Send test VAA from solana")]
    SendTestVAA {
        #[clap(
            long,
            default_value = "~/.config/solana/id.json",
            help = "Keypair file the funder of the transaction"
        )]
        keypair: String,
    },
    #[clap(about = "Get test wormhole payload for squads-cli")]
    GetTestPayload {},
    #[clap(about = "Get set upgrade authority payload for squads-cli")]
    GetSetUpgradeAuthorityPayload {
        #[clap(short, long, help = "Current authority")]
        current:    Pubkey,
        #[clap(short, long, help = "New authority")]
        new:        Pubkey,
        #[clap(short, long, help = "Program id")]
        program_id: Pubkey,
    },
    #[clap(about = "Get upgrade program payload for squads-cli")]
    GetUpgradeProgramPayload {
        #[clap(short, long, help = "Current authority")]
        authority:  Pubkey,
        #[clap(short, long, help = "Program id")]
        program_id: Pubkey,
        #[clap(short, long, help = "New buffer")]
        new_buffer: Pubkey,
        #[clap(short, long, help = "Spill address")]
        spill:      Pubkey,
    },
    #[clap(about = "Map solana key to pythnet key")]
    MapKey {
        #[clap(short, long, help = "Pubkey to map")]
        pubkey: Pubkey,
    },
}
