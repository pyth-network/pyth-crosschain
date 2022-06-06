//! CLI options

use solana_program::pubkey::Pubkey;
use solana_sdk::commitment_config::CommitmentConfig;
use std::path::PathBuf;

use clap::{
    Parser,
    Subcommand,
};

#[derive(Parser)]
#[clap(
    about = "A client for the pyth2wormhole Solana program",
    author = "Pyth Network Contributors"
)]
pub struct Cli {
    #[clap(
        short,
        long,
        default_value = "3",
        help = "Logging level, where 0..=1 RUST_LOG=error and 5.. is RUST_LOG=trace"
    )]
    pub log_level: u32,
    #[clap(
        long,
        help = "Identity JSON file for the entity meant to cover transaction costs",
        default_value = "~/.config/solana/id.json"
    )]
    pub payer: String,
    #[clap(short, long, default_value = "http://localhost:8899")]
    pub rpc_url: String,
    #[clap(long = "rpc-interval", default_value = "150", help = "Rate-limiting minimum delay between RPC requests in milliseconds")]
    pub rpc_interval_ms: u64,
    #[clap(long, default_value = "confirmed")]
    pub commitment: CommitmentConfig,
    #[clap(long)]
    pub p2w_addr: Pubkey,
    #[clap(subcommand)]
    pub action: Action,
}

#[derive(Subcommand)]
pub enum Action {
    #[clap(about = "Initialize a pyth2wormhole program freshly deployed under <p2w_addr>")]
    Init {
        /// The bridge program account
        #[clap(short = 'w', long = "wh-prog")]
        wh_prog: Pubkey,
        #[clap(short = 'o', long = "owner")]
        owner_addr: Pubkey,
        #[clap(short = 'p', long = "pyth-owner")]
        pyth_owner_addr: Pubkey,
    },
    #[clap(
        about = "Use an existing pyth2wormhole program to attest product price information to another chain"
    )]
    // Note: defaults target SOL mainnet-beta conditions at implementation time
    Attest {
        #[clap(short = 'f', long = "--config", help = "Attestation YAML config")]
        attestation_cfg: PathBuf,
        #[clap(
            short = 'n',
            long = "--n-retries",
            help = "How many times to retry send_transaction() on each batch before flagging a failure. Only active outside daemon mode",
            default_value = "5"
        )]
        n_retries: usize,
        #[clap(
            short = 'i',
            long = "--retry-interval",
            help = "How long to wait between send_transaction
            retries. Only active outside daemon mode",
            default_value = "5"
        )]
        retry_interval_secs: u64,
        #[clap(
            short = 'd',
            long = "--daemon",
            help = "Do not stop attesting. In this mode, this program will behave more like a daemon and continuously attest the specified symbols."
        )]
        daemon: bool,
        #[clap(
            short = 't',
            long = "--timeout",
            help = "How many seconds to wait before giving up on  tx confirmation.",
            default_value = "20"
        )]
        confirmation_timeout_secs: u64,
    },
    #[clap(about = "Retrieve a pyth2wormhole program's current settings")]
    GetConfig,
    #[clap(about = "Update an existing pyth2wormhole program's settings")]
    SetConfig {
        /// Current owner keypair path
        #[clap(long = "owner", default_value = "~/.config/solana/id.json")]
        owner: String,
        /// New owner to set
        #[clap(long = "new-owner")]
        new_owner_addr: Pubkey,
        #[clap(long = "new-wh-prog")]
        new_wh_prog: Pubkey,
        #[clap(long = "new-pyth-owner")]
        new_pyth_owner_addr: Pubkey,
    },
}
