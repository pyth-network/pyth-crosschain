pub mod cli;

use std::{
    fs::File,
    thread,
    time::{
        Duration,
        Instant,
    },
};

use clap::Clap;
use log::{
    debug,
    error,
    info,
    warn,
    LevelFilter,
};
use solana_client::rpc_client::RpcClient;
use solana_program::pubkey::Pubkey;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    signature::{
        read_keypair_file,
        Signature,
    },
};
use solana_transaction_status::UiTransactionEncoding;
use solitaire::{
    processors::seeded::Seeded,
    ErrBox,
};
use solitaire_client::Keypair;

use cli::{
    Action,
    Cli,
};

use p2w_sdk::P2WEmitter;

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
            n_retries,
            daemon,
            batch_interval_secs,
            conf_timeout_secs,
            rpc_interval_ms,
        } => {
            // Load the attestation config yaml
            let attestation_cfg: AttestationConfig =
                serde_yaml::from_reader(File::open(attestation_cfg)?)?;

            handle_attest(
                &rpc_client,
                payer,
                p2w_addr,
                &attestation_cfg,
                n_retries,
                daemon,
                Duration::from_secs(batch_interval_secs),
                Duration::from_secs(conf_timeout_secs),
                Duration::from_millis(rpc_interval_ms),
            )?;
        }
    }

    Ok(())
}

#[derive(Debug)]
pub enum BatchTxState<'a> {
    Sending {
        symbols: &'a [P2WSymbol],
        attempt_no: usize,
    },
    Confirming {
        symbols: &'a [P2WSymbol],
        attempt_no: usize,
        signature: Signature,
        sent_at: Instant,
    },
    Success {
        symbols: &'a [P2WSymbol],
        occured_at: Instant,
        seqno: String,
    },
    FailedSend {
        symbols: &'a [P2WSymbol],
        occured_at: Instant,
        last_err: ErrBox,
    },
    FailedConfirm {
        symbols: &'a [P2WSymbol],
        occured_at: Instant,
        last_err: ErrBox,
    },
}

use BatchTxState::*;

/// Send a series of batch attestations for symbols of an attestation config.
fn handle_attest(
    rpc_client: &RpcClient,
    payer: Keypair,
    p2w_addr: Pubkey,
    attestation_cfg: &AttestationConfig,
    n_retries: usize,
    daemon: bool,
    batch_interval: Duration,
    conf_timeout: Duration,
    rpc_interval: Duration,
) -> Result<(), ErrBox> {
    // Derive seeded accounts
    let emitter_addr = P2WEmitter::key(None, &p2w_addr);

    info!("Using emitter addr {}", emitter_addr);

    let config = get_config_account(rpc_client, &p2w_addr)?;

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
        config.max_batch_size,
        batch_count
    );

    // Reused for failed batch retries
    let mut batches: Vec<_> = attestation_cfg
        .symbols
        .as_slice()
        .chunks(config.max_batch_size as usize)
        .enumerate()
        .map(|(idx, symbols)| {
            (
                idx + 1,
                BatchTxState::Sending {
                    symbols,
                    attempt_no: 1,
                },
            )
        })
        .collect();

    // NOTE(2022-04-26): only increment this if `daemon` is false
    let mut finished_count = 0;

    // TODO(2021-03-09): Extract logic into helper functions
    while daemon || finished_count < batches.len() {
        finished_count = 0;
        for (batch_no, state) in batches.iter_mut() {
            match state {
                BatchTxState::Sending {
                    symbols,
                    attempt_no,
                } => {
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

                    // Send the transaction
                    let res = rpc_client
                        .get_latest_blockhash()
                        .map_err(|e| -> ErrBox { e.into() })
                        .and_then(|latest_blockhash| {
                            let tx_signed = gen_attest_tx(
                                p2w_addr,
                                &config,
                                &payer,
                                symbols,
                                &Keypair::new(),
                                latest_blockhash,
                            )?;

                            rpc_client
                                .send_transaction(&tx_signed)
                                .map_err(|e| -> ErrBox { e.into() })
                        });

                    // Individual batch errors mustn't prevent other batches from being sent.
                    match res {
                        Ok(signature) => {
                            info!(
                                "Batch {}/{} tx send: OK (Attempt {} of {})",
                                batch_no, batch_count, attempt_no, n_retries
                            );

                            // Record when we've sent this tx

                            *state = BatchTxState::Confirming {
                                symbols,
                                attempt_no: *attempt_no,
                                signature,
                                sent_at: Instant::now(),
                            }
                        }
                        Err(e) => {
                            let msg = format!(
                                "Batch {}/{} tx send error (attempt {} of {}): {}",
                                batch_no,
                                batch_count,
                                attempt_no,
                                n_retries + 1,
                                e.to_string()
                            );
                            warn!("{}", &msg);

                            if *attempt_no < n_retries {
                                *state = BatchTxState::Sending {
                                    attempt_no: *attempt_no + 1,
                                    symbols,
                                }
                            } else {
                                // This batch failed all attempts, note the error but do not schedule for retry
                                error!(
                                    "Batch {}/{} tx send: All {} attempts failed",
                                    batch_no,
                                    batch_count,
                                    n_retries + 1
                                );
                                *state = BatchTxState::FailedSend {
                                    symbols,
                                    occured_at: Instant::now(),
                                    last_err: e,
                                };
                            }
                        }
                    }
                }
                BatchTxState::Confirming {
                    symbols,
                    attempt_no,
                    signature,
                    sent_at,
                } => {
                    let res = rpc_client
                        .get_transaction(&signature, UiTransactionEncoding::Json)
                        .map_err(|e| -> ErrBox { e.into() })
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

                    match res {
                        Ok(seqno) => {
                            // NOTE(2022-03-09): p2w_autoattest.py relies on parsing this println!()
                            println!("Sequence number: {}", seqno);
                            info!("Batch {}/{}: OK, seqno {}", batch_no, batch_count, seqno);

                            *state = BatchTxState::Success {
                                symbols,
                                seqno,
                                occured_at: Instant::now(),
                            };
                        }
                        Err(e) => {
                            let elapsed = sent_at.elapsed();
                            let msg = format!(
                                "Batch {}/{} tx confirmation failed ({}.{}/{}.{}): {}",
                                batch_no,
                                batch_count,
                                elapsed.as_secs(),
                                elapsed.subsec_millis(),
                                conf_timeout.as_secs(),
                                conf_timeout.subsec_millis(),
                                e.to_string()
                            );
                            debug!("{}", &msg); // Output volume usually not suitable for warn!()

                            if elapsed > conf_timeout {
                                // This batch exceeded the timeout,
                                // note the error and schedule for a
                                // fresh send attempt
                                warn!(
                                    "Batch {}/{} tx confirm: Took more than {}.{} seconds (attempt {} of {}): {}",
                                    batch_no,
                                    batch_count,
                                    conf_timeout.as_secs(),
                                    conf_timeout.subsec_millis(),
				    attempt_no, n_retries,
				    msg
                                );

                                if *attempt_no < n_retries {
                                    *state = BatchTxState::Sending {
                                        symbols,
                                        attempt_no: *attempt_no + 1,
                                    };
                                } else {
                                    error!(
                                        "Batch {}/{} tx confirm: All {} attempts failed",
                                        batch_no,
                                        batch_count,
                                        n_retries + 1
                                    );
                                    *state = BatchTxState::FailedConfirm {
                                        symbols,
                                        occured_at: Instant::now(),
                                        last_err: e,
                                    };
                                }
                            }
                        }
                    }
                }
                Success {
                    symbols,
                    occured_at,
                    ..
                }
                | FailedSend {
                    symbols,
                    occured_at,
                    ..
                }
                | FailedConfirm {
                    symbols,
                    occured_at,
                    ..
                } => {
                    // We only try to re-schedule under --daemon
                    if daemon {
                        if occured_at.elapsed() > batch_interval {
                            *state = BatchTxState::Sending {
                                symbols,
                                attempt_no: 1,
                            };
                        }
                    } 
                    // Track the finished batches
                    finished_count += 1;

                    continue; // No RPC requests are made any of these cases, skip sleep
                }
            }

            thread::sleep(rpc_interval);
        }
    }

    let mut errors = Vec::new();

    // Filter out errors
    for (batch_no, state) in batches {
        use BatchTxState::*;
        match state {
            Success { .. } => {}
            FailedSend { last_err, .. } | FailedConfirm { last_err, .. } => {
                errors.push(last_err.to_string())
            }
            other => {
                // Be loud about non-terminal states left behind
                let msg = format!(
                    "INTERNAL: Batch {} left in non-terminal state {:#?}",
                    batch_no, other
                );

                error!("{}", msg);

                errors.push(msg);
            }
        }
    }

    if !errors.is_empty() {
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
