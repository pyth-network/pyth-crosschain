mod cli;
mod evm;
mod util;

use clap::Parser;
use ethers::prelude::{Address, Http, Provider};

use std::io::{self, Write};

use cli::{Action, Cli, CliInteractive};
use util::ErrBox;

pub const PROMPT: &'static str = concat!(env!("CARGO_PKG_NAME"), "> ");

#[tokio::main]
async fn main() -> Result<(), ErrBox> {
    let cli = Cli::parse();

    // Handle interactive mode separately
    if cli.action == Action::Interactive {
        start_cli_interactive(cli).await?;
    } else {
        handle_action_noninteractive(&cli).await?;
    }
    Ok(())
}

pub async fn start_cli_interactive(mut cli: Cli) -> Result<(), ErrBox> {
    let stdin = io::stdin();
    loop {
        print!("{}", PROMPT);
        io::stdout().flush()?;
        let mut ln = String::new();
        stdin.read_line(&mut ln)?;

        if ln.trim().is_empty() {
            continue;
        }

        match shell_words::split(&ln)
            .map_err(|e| -> ErrBox { e.into() })
            .and_then(|mut shell_split| {
                // Trick clap into thinking there's a binary name
                let mut with_name = vec!["".to_owned()];
                with_name.append(&mut shell_split);
                Ok(CliInteractive::try_parse_from(with_name)?)
            }) {
            Err(e) => {
                println!("Could not understand that! Error:\n{}", e.to_string());
            }
            Ok(cmd) => {
                // We just swap out the action, preserving the top-level arguments
                cli.action = cmd.action;
                handle_action_noninteractive(&cli).await?
            }
        };
    }
}

/// The following code is reused by interactive mode. Interactive mode
/// is assumed to already be detected at top-level in main, making it an invalid action.
pub async fn handle_action_noninteractive(cli: &Cli) -> Result<(), ErrBox> {
    match &cli.action {
        // It makes no sense starting interactive already inside it
        Action::Interactive => {
            return Err(format!("Bruh...?").into());
        }
        Action::PingAll => {
            println!("Pinging all blockchains...");

            let client = Provider::<Http>::try_from("http://localhost:8545")?;
            let addr: Address = "0xe982E462b094850F12AF94d21D470e21bE9D0E9C".parse()?;

            evm::query_pyth_receiver_evm(client, addr).await?;
        }
    }
    Ok(())
}
