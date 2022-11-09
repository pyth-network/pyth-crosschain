mod cli;
mod config_schema;
mod evm;
mod network;
mod util;

use clap::Parser;

use std::io::{self, Write};

use cli::{Action, Cli, CliInteractive};
use config_schema::ConfigSchema;
use network::{ping_all_evm, NetKind};
use util::ErrBoxSend;

#[tokio::main]
async fn main() -> Result<(), ErrBoxSend> {
    let cli = Cli::parse();

    let cfg_defaults = config::Config::try_from(&ConfigSchema::default())?;

    let mut cfg_builder = config::Config::builder().add_source(cfg_defaults);

    if let Some(cfg_path) = cli.config_file.as_ref() {
        cfg_builder = cfg_builder
            .add_source(config::File::with_name(cfg_path))
            .set_override("is_tainted", true)?; // Helps inform that defaults were altered
    }

    let cfg: ConfigSchema = cfg_builder.build()?.try_deserialize()?;

    // Handle interactive mode separately
    if cli.action == Action::Interactive {
        start_cli_interactive(cli, cfg).await?;
    } else {
        handle_action_noninteractive(&cli, &cfg).await?;
    }
    Ok(())
}

pub fn build_prompt(is_tainted: bool, net: &NetKind) -> String {
    format!(
        "{} {:?} {}> ",
        env!("CARGO_PKG_NAME"),
        net,
        if is_tainted { "TAINTED" } else { "CLEAN" }
    )
}

pub async fn start_cli_interactive(mut cli: Cli, cfg: ConfigSchema) -> Result<(), ErrBoxSend> {
    let stdin = io::stdin();
    loop {
        print!("{}", build_prompt(cfg.is_tainted, &cli.net));
        io::stdout().flush()?;
        let mut ln = String::new();
        stdin.read_line(&mut ln)?;

        let ln = ln.trim();
        if ln.is_empty() {
            continue;
        }

        match shell_words::split(&ln)
            .map_err(|e| -> ErrBoxSend { e.into() })
            .and_then(|mut shell_split| {
                // Trick clap into thinking there's a binary name
                let mut with_name = vec!["".to_owned()];
                with_name.append(&mut shell_split);
                Ok(CliInteractive::try_parse_from(with_name)?)
            }) {
            Err(e) => {
                println!("Could not understand that!\n{}", e.to_string());
            }
            Ok(cmd) => {
                // We just swap out the action, preserving the top-level arguments
                cli.action = cmd.action;
                match handle_action_noninteractive(&cli, &cfg).await {
                    Ok(()) => {
                        println!("{}: OK", ln);
                    }
                    Err(e) => {
                        println!("{}: ERROR\n{}", ln, e.to_string());
                    }
                }
            }
        };
    }
}

/// The following code is reused by interactive mode. Interactive mode
/// is assumed to already be detected at top-level in main, making it an invalid action.
pub async fn handle_action_noninteractive(cli: &Cli, cfg: &ConfigSchema) -> Result<(), ErrBoxSend> {
    match &cli.action {
        // It makes no sense starting interactive already inside it. 
        Action::Interactive => {
            return Err(format!("Bruh...?").into());
        }
        Action::PingAll => {
            println!("Pinging all blockchains...");

            // TODO(2022-11-09): Replace with chain-agnostic ping-all
            // once the abstraction is mature enough.
            match &cli.net {
                NetKind::Mainnet => {
                    ping_all_evm(&cfg.mainnet).await?;
                }
                NetKind::LocalDevnet => {
                    ping_all_evm(&cfg.local_devnet).await?;
                }
                NetKind::Testnet => {
                    ping_all_evm(&cfg.testnet).await?;
                }
            }
        }
    }
    Ok(())
}
