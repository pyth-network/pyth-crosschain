pub mod cli;

use std::{
    fs::File,
    pin::Pin,
    sync::Arc,
    thread,
    time::{
        Duration,
        Instant,
    },
};

use clap::Parser;
use futures::future::{
    Future,
    FutureExt,
    TryFuture,
    TryFutureExt,
};
use log::{
    debug,
    error,
    info,
    trace,
    warn,
    LevelFilter,
};
use solana_client::{
    client_error::ClientError,
    nonblocking::rpc_client::RpcClient,
};
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
use tokio::{
    sync::Semaphore,
    task::JoinHandle,
};

use cli::{
    Action,
    Cli,
};

use p2w_sdk::P2WEmitter;

use pyth2wormhole_client::*;

pub const SEQNO_PREFIX: &'static str = "Program log: Sequence: ";

#[tokio::main]
async fn main() -> Result<(), ErrBox> {
    let cli = Cli::parse();
    init_logging(cli.log_level);

    let payer = read_keypair_file(&*shellexpand::tilde(&cli.payer))?;
    let commitment = match cli.commitment.as_str() {
        "processed" => CommitmentConfig::processed(),
        "confirmed" => CommitmentConfig::confirmed(),
        "finalized" => CommitmentConfig::finalized(),
        other => return Err(format!("Unrecognized commitment {:?}", other).into()),
    };

    let rpc_client = RpcClient::new_with_commitment(cli.rpc_url.clone(), commitment.clone());

    let p2w_addr = cli.p2w_addr;

    let latest_blockhash = rpc_client.get_latest_blockhash().await?;

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
            rpc_client
                .send_and_confirm_transaction_with_spinner(&tx)
                .await?;
        }
        Action::GetConfig => {
            println!("{:?}", get_config_account(&rpc_client, &p2w_addr).await?);
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
            rpc_client
                .send_and_confirm_transaction_with_spinner(&tx)
                .await?;
        }
        Action::Attest {
            ref attestation_cfg,
            n_retries,
            retry_interval_secs,
            confirmation_timeout_secs,
            daemon,
        } => {
            // Load the attestation config yaml
            let attestation_cfg: AttestationConfig =
                serde_yaml::from_reader(File::open(attestation_cfg)?)?;

            handle_attest(
                cli.rpc_url,
                Duration::from_millis(cli.rpc_interval_ms),
                commitment,
                payer,
                p2w_addr,
                attestation_cfg,
                n_retries,
                Duration::from_secs(retry_interval_secs),
                Duration::from_secs(confirmation_timeout_secs),
                daemon,
            )
            .await?;
        }
    }

    Ok(())
}

/// Send a series of batch attestations for symbols of an attestation config.
async fn handle_attest(
    rpc_url: String,
    rpc_interval: Duration,
    commitment: CommitmentConfig,
    payer: Keypair,
    p2w_addr: Pubkey,
    attestation_cfg: AttestationConfig,
    n_retries: usize,
    retry_interval: Duration,
    confirmation_timeout: Duration,
    daemon: bool,
) -> Result<(), ErrBox> {

    // Derive seeded accounts
    let emitter_addr = P2WEmitter::key(None, &p2w_addr);

    info!("Using emitter addr {}", emitter_addr);

    let config = get_config_account(
        &RpcClient::new_with_timeout_and_commitment(
            rpc_url.clone(),
            confirmation_timeout,
            commitment.clone(),
        ),
        &p2w_addr,
    )
    .await?;

    debug!("Symbol config:\n{:#?}", attestation_cfg);

    info!(
        "{} symbol groups read, dividing into batches",
        attestation_cfg.symbol_groups.len(),
    );

    // Reused for failed batch retries
    let mut batches: Vec<_> = attestation_cfg
        .symbol_groups
        .iter()
        .map(|g| {
            let conditions4closure = g.conditions.clone();
            let name4closure = g.group_name.clone();

            info!("Group {:?}, {} symbols", g.group_name, g.symbols.len(),);

            // Divide group into batches
            g.symbols
                .as_slice()
                .chunks(config.max_batch_size as usize)
                .map(move |symbols| {
                    BatchState::new(name4closure.clone(), symbols, conditions4closure.clone())
                })
        })
        .flatten()
        .enumerate()
        .map(|(idx, batch_state)| (idx + 1, batch_state))
        .collect();
    let batch_count = batches.len();

    let rpc = Arc::new(RLMutex::new(RpcCfg {url: rpc_url, timeout: confirmation_timeout, commitment: commitment.clone() }, rpc_interval));

    // Each future schedules individual attestation attempts per
    // batch. Without daemon mode, we return after the first job is
    // complete on the batch. In daemon mode, we never return and
    // resend each batch continuously according to attestation conditions.
    let attestation_sched_futs = batches.into_iter().map(|(batch_no, b)| {
        let config4fut = config.clone();
        let p2w_addr4fut = p2w_addr.clone();
        let payer4fut = Keypair::from_bytes(&payer.to_bytes()).unwrap(); // Keypair has no clone
        let rpc4fut = rpc.clone();
        let commitment4fut = commitment.clone();
        let batch_count4fut = batch_count;
        let mut b4fut = b;
        // Enforces the max batch job count
        let sema = Arc::new(Semaphore::new(b4fut.conditions.max_batch_jobs));
        async move {
            let mut retries_left = n_retries;
            loop {
                debug!(
                    "Batch {}/{}, group {:?}: Scheduling attestation job",
                    batch_no, batch_count4fut, b4fut.group_name
                );

                let rpc4job = rpc4fut.clone(); 

                let payer4job = Keypair::from_bytes(&payer4fut.to_bytes()).unwrap(); // Keypair has no clone

                let job = attestation_job(
                    rpc4job,
                    batch_no,
                    batch_count4fut,
                    b4fut.group_name.clone(),
                    p2w_addr4fut,
                    config4fut.clone(),
                    payer4job,
                    b4fut.symbols.to_vec(),
                    sema.clone(),
                );

                if daemon {
                    // park this routine until a resend condition is met
                    loop {
                        if let Some(reason) = b4fut.should_resend(&lock_and_make_rpc(&rpc4fut).await).await {
                            info!(
                                "Batch {}/{}, group {}: Resending (reason: {:?})",
                                batch_no, batch_count4fut, b4fut.group_name, reason
                            );
                            break;
                        }
                    }

                    if sema.available_permits() == 0 {
                        warn!(
                            "Batch {}/{}, group {:?}: Ran out of job \
                             permits, some attestation conditions may be \
                             delayed. For better accuracy, increase \
                             max_batch_jobs or adjust attestation \
                             conditions",
                            batch_no, batch_count4fut, b4fut.group_name
                        );
                    }

                    // This short-lived permit prevents scheduling
                    // excess attestation jobs (which could eventually
                    // eat all memory). It is freed as soon as we
                    // leave this code block.
                    let _permit4sched = sema.acquire().await?;

                    let batch_no4err_msg = batch_no.clone();
                    let batch_count4err_msg = batch_count4fut.clone();
                    let group_name4err_msg = b4fut.group_name.clone();

                    // We never get to error reporting in daemon mode, attach a map_err
                    let job_with_err_msg = job.map_err(move |e| async move {
                        warn!(
                            "Batch {}/{}, group {:?} ERR: {}",
                            batch_no4err_msg,
                            batch_count4err_msg,
                            group_name4err_msg,
                            e.to_string()
                        );
                        e
                    });

                    // Daemon mode never returns, spawn and don't wait
                    let _detached_job: JoinHandle<_> = tokio::spawn(job_with_err_msg);

                    // Await and return the single result in non-daemon mode, with retries if necessary
                } else {
                    match job.await {
                        Ok(_) => return Ok(()),
                        Err(e) => {
                            if retries_left == 0 {
                                return Err(e);
                            } else {
                                retries_left -= 1;
                                debug!(
                                    "{}/{}, group {:?}: attestation failure: {}",
                                    batch_no,
                                    batch_count,
                                    b4fut.group_name,
                                    e.to_string()
                                );
                                info!(
                                    "Batch {}/{}, group {:?}: retrying in {}.{}s, {} retries left",
                                    batch_no,
                                    batch_count,
                                    b4fut.group_name,
                                    retry_interval.as_secs(),
                                    retry_interval.subsec_millis(),
                                    retries_left,
                                );

                                tokio::time::sleep(retry_interval).await;
                            }
                        }
                    }
                }

                b4fut.last_job_finished_at = Instant::now();
            }
        }
    });

    info!("Scheduling attestations");

    let results = futures::future::join_all(attestation_sched_futs).await; // May never finish for daemon mode

    info!("Got {} results", results.len());

    let errors: Vec<_> = results
        .iter()
        .filter_map(|r| {
            if let Err(e) = r {
                Some(e.to_string())
            } else {
                None
            }
        })
        .collect();

    if !errors.is_empty() {
        let err_lines = errors.join("\n");
        let msg = format!(
            "{} of {} batches failed:\n{}",
            errors.len(),
            batch_count,
            err_lines
        );
        error!("{}", msg);
        return Err(msg.into());
    }

    Ok(())
}

#[derive(Clone)]
pub struct RpcCfg {
    pub url: String,
    pub timeout: Duration,
    pub commitment: CommitmentConfig,
}

async fn lock_and_make_rpc(rlmtx: &RLMutex<RpcCfg>) -> RpcClient {
    let RpcCfg {url, timeout, commitment} = rlmtx.lock().await.clone();
    RpcClient::new_with_timeout_and_commitment(url, timeout, commitment)
}

/// A future for a single attempt to attest a batch on Solana.
async fn attestation_job(
    rlmtx: Arc<RLMutex<RpcCfg>>,
    batch_no: usize,
    batch_count: usize,
    group_name: String,
    p2w_addr: Pubkey,
    config: Pyth2WormholeConfig,
    payer: Keypair,
    symbols: Vec<P2WSymbol>,
    max_jobs_sema: Arc<Semaphore>,
) -> Result<(), ErrBoxSend> {
    // Will be dropped after attestation is complete
    let _permit = max_jobs_sema.acquire().await?;

    debug!(
        "Batch {}/{}, group {:?}: Starting attestation job",
        batch_no, batch_count, group_name
    );
    let rpc = lock_and_make_rpc(&*rlmtx).await; // Reuse the same lock for the blockhash/tx/get_transaction
    let latest_blockhash = rpc
        .get_latest_blockhash()
        .map_err(|e| -> ErrBoxSend { e.into() })
        .await?;

    let tx_res: Result<_, ErrBoxSend> = gen_attest_tx(
        p2w_addr,
        &config,
        &payer,
        symbols.as_slice(),
        &Keypair::new(),
        latest_blockhash,
    );
    let tx = tx_res?;
    let sig = rpc
        .send_and_confirm_transaction(&tx)
        .map_err(|e| -> ErrBoxSend { e.into() })
        .await?;
    let tx_data = rpc
        .get_transaction(&sig, UiTransactionEncoding::Json)
        .map_err(|e| -> ErrBoxSend { e.into() })
        .await?;
    let seqno = tx_data
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
        .ok_or_else(|| -> ErrBoxSend { format!("No seqno in program logs").into() })?;

    info!(
        "Batch {}/{}, group {:?} OK",
        batch_no, batch_count, group_name
    );
    // NOTE(2022-03-09): p2w_autoattest.py relies on parsing this println!{}
    println!("Sequence number: {}", seqno);
    Result::<(), ErrBoxSend>::Ok(())
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
