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
    rpc_config::RpcTransactionConfig,
};
use solana_program::pubkey::Pubkey;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    signature::{
        read_keypair_file,
        Signature,
    },
    signer::keypair::Keypair,
};
use solana_transaction_status::UiTransactionEncoding;
use solitaire::{
    processors::seeded::Seeded,
    ErrBox,
};
use tokio::{
    sync::{
        Mutex,
        Semaphore,
    },
    task::JoinHandle,
};

use cli::{
    Action,
    Cli,
};

use p2w_sdk::P2WEmitter;

use pyth2wormhole::{
    attest::P2W_MAX_BATCH_SIZE,
    Pyth2WormholeConfig,
};
use pyth2wormhole_client::*;

pub const SEQNO_PREFIX: &'static str = "Program log: Sequence: ";

#[tokio::main]
async fn main() -> Result<(), ErrBox> {
    let cli = Cli::parse();
    init_logging();

    // All other CLI actions make rpc requests, this one's meant to be
    // off-chain explicitly
    if let Action::GetEmitter = cli.action {
        let emitter_addr = P2WEmitter::key(None, &cli.p2w_addr);
        println!("{}", emitter_addr);

        // Exit early
        return Ok(());
    }

    let payer = read_keypair_file(&*shellexpand::tilde(&cli.payer))?;

    let rpc_client = RpcClient::new_with_commitment(cli.rpc_url.clone(), cli.commitment.clone());

    let p2w_addr = cli.p2w_addr;

    let latest_blockhash = rpc_client.get_latest_blockhash().await?;

    match cli.action {
        Action::Init {
            owner_addr,
            pyth_owner_addr,
            wh_prog,
            is_active,
            ops_owner_addr,
        } => {
            let tx = gen_init_tx(
                payer,
                p2w_addr,
                Pyth2WormholeConfig {
                    owner: owner_addr,
                    wh_prog,
                    pyth_owner: pyth_owner_addr,
                    is_active: is_active.unwrap_or(true),
                    max_batch_size: P2W_MAX_BATCH_SIZE,
                    ops_owner: ops_owner_addr,
                },
                latest_blockhash,
            )?;
            rpc_client
                .send_and_confirm_transaction_with_spinner(&tx)
                .await?;
            println!(
                "Initialized with config:\n{:?}",
                get_config_account(&rpc_client, &p2w_addr).await?
            );
        }
        Action::GetConfig => {
            println!("{:?}", get_config_account(&rpc_client, &p2w_addr).await?);
        }
        Action::SetConfig {
            ref owner,
            new_owner_addr,
            new_wh_prog,
            new_pyth_owner_addr,
            is_active,
            ops_owner_addr,
            remove_ops_owner,
        } => {
            let old_config = get_config_account(&rpc_client, &p2w_addr).await?;
            
            let new_ops_owner = if remove_ops_owner {
                None
            } else {
                ops_owner_addr
            };

            let tx = gen_set_config_tx(
                payer,
                p2w_addr,
                read_keypair_file(&*shellexpand::tilde(&owner))?,
                Pyth2WormholeConfig {
                    owner: new_owner_addr.unwrap_or(old_config.owner),
                    wh_prog: new_wh_prog.unwrap_or(old_config.wh_prog),
                    pyth_owner: new_pyth_owner_addr.unwrap_or(old_config.pyth_owner),
                    is_active: is_active.unwrap_or(old_config.is_active),
                    max_batch_size: P2W_MAX_BATCH_SIZE,
                    ops_owner: new_ops_owner,
                },
                latest_blockhash,
            )?;
            rpc_client
                .send_and_confirm_transaction_with_spinner(&tx)
                .await?;
            println!(
                "Applied config:\n{:?}",
                get_config_account(&rpc_client, &p2w_addr).await?
            );
        }
        Action::Migrate { ref owner } => {
            let tx = gen_migrate_tx(
                payer,
                p2w_addr,
                read_keypair_file(&*shellexpand::tilde(&owner))?,
                latest_blockhash,
            )?;
            rpc_client
                .send_and_confirm_transaction_with_spinner(&tx)
                .await?;
            println!(
                "Applied config:\n{:?}",
                get_config_account(&rpc_client, &p2w_addr).await?
            );
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

            if let Some(mapping_addr) = attestation_cfg.mapping_addr.as_ref() {
                let additional_accounts = crawl_pyth_mapping(&rpc_client, mapping_addr).await?;
                info!("Additional mapping accounts:\n{:#?}", additional_accounts);
            }

            handle_attest(
                cli.rpc_url,
                Duration::from_millis(cli.rpc_interval_ms),
                cli.commitment,
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
        Action::GetEmitter => unreachable! {}, // It is handled early in this function.
        Action::SetIsActive { ops_owner, new_is_active } => {            
            let tx = gen_set_is_active_tx(
                payer,
                p2w_addr,
                read_keypair_file(&*shellexpand::tilde(&ops_owner))?,
                new_is_active.eq_ignore_ascii_case("true"),
                latest_blockhash,
            )?;
            rpc_client
                .send_and_confirm_transaction_with_spinner(&tx)
                .await?;
            println!(
                "Applied config:\n{:?}",
                get_config_account(&rpc_client, &p2w_addr).await?
            );
        },
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

    /// Note: For global rate-limitting of RPC requests, we use a
    /// custom Mutex wrapper which enforces a delay of rpc_interval
    /// between RPC accesses.
    let rpc_cfg = Arc::new(RLMutex::new(
        RpcCfg {
            url: rpc_url,
            timeout: confirmation_timeout,
            commitment: commitment.clone(),
        },
        rpc_interval,
    ));

    let message_q_mtx = Arc::new(Mutex::new(P2WMessageQueue::new(
        Duration::from_millis(attestation_cfg.min_msg_reuse_interval_ms),
        attestation_cfg.max_msg_accounts as usize,
    )));

    // Create attestation scheduling routines; see attestation_sched_job() for details
    let mut attestation_sched_futs = batches.into_iter().map(|(batch_no, batch)| {
        attestation_sched_job(
            batch,
            batch_no,
            batch_count,
            n_retries,
            retry_interval,
            daemon,
            rpc_cfg.clone(),
            p2w_addr,
            config.clone(),
            Keypair::from_bytes(&payer.to_bytes()).unwrap(),
            message_q_mtx.clone(),
        )
    });

    info!("Spinning up attestation sched jobs");

    let results = futures::future::join_all(attestation_sched_futs).await; // May never finish for daemon mode

    info!("Got {} results", results.len());

    // With daemon mode off, the sched jobs return from the
    // join_all. We filter out errors and report them
    let errors: Vec<_> = results
        .iter()
        .enumerate()
        .filter_map(|(idx, r)| {
            r.as_ref()
                .err()
                .map(|e| format!("Error {}: {:#?}\n", idx + 1, e))
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

/// Helper function for claiming the rate-limited mutex and constructing an RPC instance
async fn lock_and_make_rpc(rlmtx: &RLMutex<RpcCfg>) -> RpcClient {
    let RpcCfg {
        url,
        timeout,
        commitment,
    } = rlmtx.lock().await.clone();
    RpcClient::new_with_timeout_and_commitment(url, timeout, commitment)
}

/// A future that decides how a batch is sent.
///
/// In daemon mode, attestations of the batch are scheduled
/// continuously using spawn(), which means that a next attestation of
/// the same batch begins immediately when a condition is met without
/// waiting for the previous attempt to finish. Subsequent
/// attestations are started according to the attestation_conditions
/// field on the batch. Concurrent requests per batch are limited by
/// the max_batch_jobs field to prevent excess memory usage on network
/// slowdowns etc..
///
/// With daemon_mode off, this future attempts only one blocking
/// attestation of the batch and returns the result.
async fn attestation_sched_job(
    mut batch: BatchState<'_>,
    batch_no: usize,
    batch_count: usize,
    n_retries: usize,
    retry_interval: Duration,
    daemon: bool,
    rpc_cfg: Arc<RLMutex<RpcCfg>>,
    p2w_addr: Pubkey,
    config: Pyth2WormholeConfig,
    payer: Keypair,
    message_q_mtx: Arc<Mutex<P2WMessageQueue>>,
) -> Result<(), ErrBoxSend> {
    let mut retries_left = n_retries;
    // Enforces the max batch job count
    let sema = Arc::new(Semaphore::new(batch.conditions.max_batch_jobs));
    loop {
        debug!(
            "Batch {}/{}, group {:?}: Scheduling attestation job",
            batch_no, batch_count, batch.group_name
        );

        let job = attestation_job(
            rpc_cfg.clone(),
            batch_no,
            batch_count,
            batch.group_name.clone(),
            p2w_addr,
            config.clone(),
            Keypair::from_bytes(&payer.to_bytes()).unwrap(), // Keypair has no clone
            batch.symbols.to_vec(),
            sema.clone(),
            message_q_mtx.clone(),
        );

        if daemon {
            // park this routine until a resend condition is met
            loop {
                if let Some(reason) = batch
                    .should_resend(&lock_and_make_rpc(&rpc_cfg).await)
                    .await
                {
                    info!(
                        "Batch {}/{}, group {}: Resending (reason: {:?})",
                        batch_no, batch_count, batch.group_name, reason
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
                    batch_no, batch_count, batch.group_name
                );
            }

            // This short-lived permit prevents scheduling
            // excess attestation jobs (which could eventually
            // eat all memory). It is freed as soon as we
            // leave this code block.
            let _permit4sched = sema.acquire().await?;

            let batch_no4err_msg = batch_no.clone();
            let batch_count4err_msg = batch_count.clone();
            let group_name4err_msg = batch.group_name.clone();

            // We never get to error reporting in daemon mode, attach a map_err
            let job_with_err_msg = job.map_err(move |e| {
                warn!(
                    "Batch {}/{}, group {:?} ERR: {:#?}",
                    batch_no4err_msg, batch_count4err_msg, group_name4err_msg, e
                );
                e
            });

            // Spawn the job in background
            let _detached_job: JoinHandle<_> = tokio::spawn(job_with_err_msg);
        } else {
            // Await and return the single result in non-daemon mode, with retries if necessary
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
                            batch.group_name,
                            e.to_string()
                        );
                        info!(
                            "Batch {}/{}, group {:?}: retrying in {}.{}s, {} retries left",
                            batch_no,
                            batch_count,
                            batch.group_name,
                            retry_interval.as_secs(),
                            retry_interval.subsec_millis(),
                            retries_left,
                        );

                        tokio::time::sleep(retry_interval).await;
                    }
                }
            }
        }

        batch.last_job_finished_at = Instant::now();
    }
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
    message_q_mtx: Arc<Mutex<P2WMessageQueue>>,
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

    let wh_msg_id = message_q_mtx.lock().await.get_account()?.id;

    let tx_res: Result<_, ErrBoxSend> = gen_attest_tx(
        p2w_addr,
        &config,
        &payer,
        wh_msg_id,
        symbols.as_slice(),
        latest_blockhash,
    );
    let sig = rpc
        .send_and_confirm_transaction(&tx_res?)
        .map_err(|e| -> ErrBoxSend { e.into() })
        .await?;
    let tx_data = rpc
        .get_transaction_with_config(
            &sig,
            RpcTransactionConfig {
                encoding: Some(UiTransactionEncoding::Json),
                commitment: Some(rpc.commitment()),
                max_supported_transaction_version: None,
            },
        )
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

fn init_logging() {
    if std::env::var("RUST_LOG").is_ok() {
        env_logger::init()
    } else {
        // Default to info if RUST_LOG not set
        env_logger::builder().filter_level(LevelFilter::Info).init();
    }
}
