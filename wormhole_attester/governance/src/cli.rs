//! CLI options
use {
    clap::{
        Parser,
        Subcommand,
    },
    solana_sdk::pubkey::Pubkey,
};

#[derive(Parser, Debug)]
#[clap(
    about = "A cli for the remote executor",
    author = "Pyth Network Contributors"
)]
pub struct Cli {
    #[clap(subcommand)]
    pub action: Action,
}

#[derive(Subcommand, Debug)]
pub enum Action {
    #[clap(about = "Get set upgrade authority payload for squads-cli")]
    GetSetConfig {
        #[clap(long, help = "Program id")]
        program_id:     Pubkey,
        #[clap(long, help = "Current owner")]
        owner:          Pubkey,
        #[clap(long, help = "Payer")]
        payer:          Pubkey,
        #[clap(long, help = "Config : New owner")]
        new_owner:      Pubkey,
        #[clap(long, help = "Config : Wormhole program id")]
        wormhole:       Pubkey,
        #[clap(long, help = "Config : Pyth program id")]
        pyth_owner:     Pubkey,
        #[clap(long, help = "Config : Max batch size")]
        max_batch_size: u16,
        #[clap(long, help = "Config : Is active")]
        is_active:      bool,
        #[clap(long, help = "Config : Ops owner")]
        ops_owner:      Option<Pubkey>,
    },
    #[clap(about = "Get upgrade program payload for squads-cli")]
    GetSetIsActive {
        #[clap(long, help = "Program id")]
        program_id: Pubkey,
        #[clap(long, help = "Current ops owner")]
        ops_owner:  Pubkey,
        #[clap(long, help = "Payer")]
        payer:      Pubkey,
        #[clap(long, help = "Config : Is active")]
        is_active:  bool,
    },
}
