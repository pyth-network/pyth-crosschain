use std::path::{Path, PathBuf};

use aiken_lang::ast::Tracing;
use anyhow::{Result, anyhow};
use clap::Parser;
use pallas::ledger::primitives::PlutusData;
use uplc::Fragment;

use crate::aiken_utils::{apply_hex_params_to_program, eval_to_data, with_project};

mod aiken_utils;

fn main() -> Result<()> {
    let opts = Opts::parse();
    match opts.command {
        Command::Eval(EvalOpts { module, name, args }) => {
            let res = eval(opts.dir.as_deref(), &module, &name, &args)?;
            let bytes = res.encode_fragment().map_err(|e| anyhow!("{e}"))?;
            println!("{}", hex::encode(bytes));
        }
    }
    Ok(())
}

fn eval(dir: Option<&Path>, module: &str, name: &str, args: &[String]) -> Result<PlutusData> {
    let mut program = None;
    with_project(dir, |project| {
        let export = project
            .export(&module, name, Tracing::verbose())
            .map_err(|e| anyhow!("{e}"))?;
        let _ = program.insert(export.program);
        Ok(())
    })?;
    let program = program.expect("missing compiled program").inner().clone();

    eval_to_data(apply_hex_params_to_program(program, args)?)
}

#[derive(clap::Parser)]
struct Opts {
    /// Project directory
    #[clap(long)]
    dir: Option<PathBuf>,
    #[clap(subcommand)]
    command: Command,
}

#[derive(clap::Subcommand)]
enum Command {
    /// Evaluate an Aiken function in the current project.
    Eval(EvalOpts),
}

#[derive(clap::Parser)]
struct EvalOpts {
    /// Aiken module
    module: String,
    /// Aiken function
    name: String,
    /// Hex-encoded CBOR of plutus data as arguments
    args: Vec<String>,
}
