pub mod cli;

use std::{
    fs::File,
};

use clap::Clap;
use log::{
    debug,
    error,
    info,
    LevelFilter,
};
use solana_client::rpc_client::RpcClient;
use solana_program::{
    pubkey::Pubkey,
};
use solana_sdk::{
    commitment_config::CommitmentConfig,
    signature::read_keypair_file,
};
use solana_transaction_status::UiTransactionEncoding;
use solitaire::{
    processors::seeded::Seeded,
    ErrBox,
};
use solitaire_client::{
    Keypair,
};

use cli::{
    Action,
    Cli,
};

use pyth2wormhole::{
    attest::{
        P2WEmitter,
    },
};


use pyth2wormhole_client::*;

pub const SEQNO_PREFIX: &'static str = "Program log: Sequence: ";

fn main() -> Result<(), ErrBox> {
    let cli = Cli::parse();
    init_logging(cli.log_level);

    let payer = read_keypair_file(&*shellexpand::tilde(&cli.payer))?;
    let rpc_client = RpcClient::new_with_commitment(cli.rpc_url, CommitmentConfig::finalized());

    let p2w_addr = cli.p2w_addr;

    let latest_blockhash = rpc_client.get_latest_blockhash()?;

    match cli.action {
        Action::Init {
            owner_addr,
            pyth_owner_addr,
            wh_prog,
        } => {
            let tx = gen_init_tx(
                payer,
                p2w_addr,
                owner_addr,
                wh_prog,
                pyth_owner_addr,
                latest_blockhash,
            )?;
            rpc_client.send_and_confirm_transaction_with_spinner(&tx)?;
        }
        Action::GetConfig => {
            println!("{:?}", get_config_account(&rpc_client, &p2w_addr)?);
        }
        Action::SetConfig {
            ref owner,
            new_owner_addr,
            new_wh_prog,
            new_pyth_owner_addr,
        } => {
            let tx = gen_set_config_tx(
                payer,
                p2w_addr,
                read_keypair_file(&*shellexpand::tilde(&owner))?,
                new_owner_addr,
                new_wh_prog,
                new_pyth_owner_addr,
                latest_blockhash,
            )?;
            rpc_client.send_and_confirm_transaction_with_spinner(&tx)?;
        }
        Action::Attest {
            ref attestation_cfg,
        } => {
            // Load the attestation config yaml
            let attestation_cfg: AttestationConfig =
                serde_yaml::from_reader(File::open(attestation_cfg)?)?;

            handle_attest(&rpc_client, payer, p2w_addr, &attestation_cfg)?;
        }
    }

    Ok(())
}
fn handle_attest(
    rpc_client: &RpcClient, // Needed for reading Pyth account data
    payer: Keypair,
    p2w_addr: Pubkey,
    attestation_cfg: &AttestationConfig,
) -> Result<(), ErrBox> {
    // Derive seeded accounts
    let emitter_addr = P2WEmitter::key(None, &p2w_addr);

    info!("Using emitter addr {}", emitter_addr);

    let config = get_config_account(rpc_client, &p2w_addr)?;

    // Read the current max batch size from the contract's settings
    let max_batch_size = config.max_batch_size;

    let batch_count = {
        let whole_batches = attestation_cfg.symbols.len() / config.max_batch_size as usize;

        // Include  partial batch if there is a remainder
        if attestation_cfg.symbols.len() % config.max_batch_size as usize > 0 {
            whole_batches + 1
        } else {
            whole_batches
        }
    };

    debug!("Symbol config:\n{:#?}", attestation_cfg);

    info!(
        "{} symbols read, max batch size {}, dividing into {} batches",
        attestation_cfg.symbols.len(),
        max_batch_size,
        batch_count
    );

    let mut errors = Vec::new();

    for (idx, symbols) in attestation_cfg
        .symbols
        .as_slice()
        .chunks(max_batch_size as usize)
        .enumerate()
    {
        let batch_no = idx + 1;
        info!(
            "Batch {}/{} contents: {:?}",
            batch_no,
            batch_count,
            symbols
                .iter()
                .map(|s| s
                    .name
                    .clone()
                    .unwrap_or(format!("unnamed product {:?}", s.product_addr)))
                .collect::<Vec<_>>()
        );

        // Execute the transaction, obtain the resulting sequence
        // number. The and_then() calls enforce permissible error
        // handling location near loop end.
        let res = rpc_client
            .get_latest_blockhash()
            .map_err(|e| -> ErrBox { e.into() })
            .and_then(|latest_blockhash| {
		let tx_signed = gen_attest_tx(p2w_addr, &config, &payer, symbols, &Keypair::new(), latest_blockhash)?;

                rpc_client.send_and_confirm_transaction_with_spinner(&tx_signed).map_err(|e| -> ErrBox { e.into() })
            })
            .and_then(|sig| rpc_client.get_transaction(&sig, UiTransactionEncoding::Json).map_err(|e| -> ErrBox { e.into() })
	    )
            .and_then(|this_tx| {
                this_tx
                    .transaction
                    .meta
                    .and_then(|meta| meta.log_messages)
                    .and_then(|logs| {
                        let mut seqno = None;
                        for log in logs {
                            if log.starts_with(SEQNO_PREFIX) {
                                seqno = Some(log.replace(SEQNO_PREFIX, ""));
                                break;
                            }
                        }
                        seqno
                    })
                    .ok_or_else(|| format!("No seqno in program logs").into())
            });

        // Individual batch errors mustn't prevent other batches from being sent.
        match res {
            Ok(seqno) => {
                println!("Sequence number: {}", seqno);
                info!("Batch {}/{}: OK, seqno {}", batch_no, batch_count, seqno);
            }
            Err(e) => {
                let msg = format!(
                    "Batch {}/{} tx error: {}",
                    batch_no,
                    batch_count,
                    e.to_string()
                );
                error!("{}", &msg);

                errors.push(msg)
            }
        }
    }

    if errors.len() > 0 {
        let err_list = errors.join("\n");

        Err(format!(
            "{} of {} batches failed:\n{}",
            errors.len(),
            batch_count,
            err_list
        )
        .into())
    } else {
        Ok(())
    }
}

fn init_logging(verbosity: u32) {
    use LevelFilter::*;
    let filter = match verbosity {
        0..=1 => Error,
        2 => Warn,
        3 => Info,
        4 => Debug,
        _other => Trace,
    };

    env_logger::builder().filter_level(filter).init();
}
