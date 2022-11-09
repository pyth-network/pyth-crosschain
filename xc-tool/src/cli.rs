use clap::{Parser, Subcommand};

use crate::network::NetKind;

#[derive(Parser)]
#[clap(
    about = "Pyth Tool - the admin swiss army knife",
    author = "Pyth Network Contributors"
)]
pub struct Cli {
    #[clap(subcommand)]
    pub action: Action,
    #[clap(help = "Network kind to act against")]
    pub net: NetKind,
    #[clap(short, help = "Optional config YAML overriding the defaults")]
    pub config_file: Option<String>,
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
    #[clap(about = "Attempt sanity-check access for all known blockchains")]
    PingAll,
    #[clap(about = "Fires up a repl letting user directly perform all other actions. Warning: Do not call already in interactive mode.")]
    Interactive,
}

