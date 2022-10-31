use clap::{Parser, Subcommand};

use crate::protocol::Net;

#[derive(Parser)]
#[clap(
    about = "Pyth Tool - the admin swiss army knife",
    author = "Pyth Network Contributors"
)]
pub struct Cli {
    #[clap(subcommand)]
    pub action: Action,
    /// Mainnet/testnet
    #[clap(default_value = "testnet")]
    pub net: Net,
}

/// This struct helps reuse action parsing logic for interactive mode.
#[derive(Parser)]
#[clap(
    about = "Pyth Tool - the admin swiss army knife",
    author = "Pyth Network Contributors"
)]
pub struct CliInteractive {
    #[clap(subcommand)]
    pub action: Action,
}

#[derive(Subcommand, PartialEq)]
pub enum Action {
    #[clap(about = "Retrieve all known data")]
    QueryAll,
    #[clap(about = "Fires up a repl letting user directly perform all other actions")]
    Interactive,
}

