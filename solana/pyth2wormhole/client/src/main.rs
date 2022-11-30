pub mod cli;

use {
    clap::Parser,
    cli::{
        Action,
        Cli,
    },
    futures::future::{
        Future,
        TryFutureExt,
    },
    generic_array::GenericArray,
    lazy_static::lazy_static,
    log::{
        debug,
        error,
        info,
        warn,
        LevelFilter,
    },
    p2w_sdk::P2WEmitter,
    prometheus::{
        register_int_counter,
        register_int_gauge,
        IntCounter,
        IntGauge,
    },
    pyth2wormhole::{
        attest::P2W_MAX_BATCH_SIZE,
        Pyth2WormholeConfig,
    },
    pyth2wormhole_client::*,
    sha3::{
        Digest,
        Sha3_256,
    },
    solana_client::{
        nonblocking::rpc_client::RpcClient,
        rpc_config::RpcTransactionConfig,
    },
    solana_program::pubkey::Pubkey,
    solana_sdk::{
        commitment_config::CommitmentConfig,
        signature::read_keypair_file,
        signer::keypair::Keypair,
    },
    solana_transaction_status::UiTransactionEncoding,
    solitaire::{
        processors::seeded::Seeded,
        ErrBox,
    },
    std::{
        fs::File,
        net::SocketAddr,
        sync::Arc,
        time::{
            Duration,
            Instant,
        },
    },
    tokio::{
        sync::{
            Mutex,
            Semaphore,
        },
        task::JoinHandle,
    },
};

pub const SEQNO_PREFIX: &str = "Program log: Sequence: ";

lazy_static! {
    static ref ATTESTATIONS_OK_CNT: IntCounter =
        register_int_counter!("attestations_ok", "Number of successful attestations").unwrap();
    static ref ATTESTATIONS_ERR_CNT: IntCounter =
        register_int_counter!("attestations_err", "Number of failed attestations").unwrap();
    static ref LAST_SEQNO_GAUGE: IntGauge = register_int_gauge!(
        "last_seqno",
        "Latest sequence number produced by this attester"
    )
    .unwrap();
}

#[tokio::main(flavor = "multi_thread")]
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

    let rpc_client = RpcClient::new_with_commitment(cli.rpc_url.clone(), cli.commitment);

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
            } else if let Some(given_ops_owner) = ops_owner_addr {
                Some(given_ops_owner)
            } else {
                old_config.ops_owner
            };

            let tx = gen_set_config_tx(
                payer,
                p2w_addr,
                read_keypair_file(&*shellexpand::tilde(&owner))?,
                Pyth2WormholeConfig {
                    owner:          new_owner_addr.unwrap_or(old_config.owner),
                    wh_prog:        new_wh_prog.unwrap_or(old_config.wh_prog),
                    pyth_owner:     new_pyth_owner_addr.unwrap_or(old_config.pyth_owner),
                    is_active:      is_active.unwrap_or(old_config.is_active),
                    max_batch_size: P2W_MAX_BATCH_SIZE,
                    ops_owner:      new_ops_owner,
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
            metrics_bind_addr,
            daemon,
        } => {
            // Load the attestation config yaml
            let attestation_cfg: AttestationConfig =
                serde_yaml::from_reader(File::open(attestation_cfg)?)?;

            // Derive seeded accounts
            let emitter_addr = P2WEmitter::key(None, &p2w_addr);

            info!("Using emitter addr {}", emitter_addr);
            // Note: For global rate-limitting of RPC requests, we use a
            // custom Mutex wrapper which enforces a delay of rpc_interval
            // between RPC accesses.
            let rpc_cfg = Arc::new(RLMutex::new(
                RpcCfg {
                    url:        cli.rpc_url,
                    timeout:    Duration::from_secs(confirmation_timeout_secs),
                    commitment: cli.commitment,
                },
                Duration::from_millis(attestation_cfg.min_rpc_interval_ms),
            ));

            if daemon {
                handle_attest_daemon_mode(
                    rpc_cfg,
                    payer,
                    p2w_addr,
                    attestation_cfg,
                    metrics_bind_addr,
                )
                .await?;
            } else {
                handle_attest_non_daemon_mode(
                    attestation_cfg,
                    rpc_cfg,
                    p2w_addr,
                    payer,
                    n_retries,
                    Duration::from_secs(retry_interval_secs),
                )
                .await?;
            }
        }
        Action::GetEmitter => unreachable! {}, // It is handled early in this function.
        Action::SetIsActive {
            ops_owner,
            new_is_active,
        } => {
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
        }
    }

    Ok(())
}

/// Continuously send batch attestations for symbols of an attestation config.
async fn handle_attest_daemon_mode(
    rpc_cfg: Arc<RLMutex<RpcCfg>>,
    payer: Keypair,
    p2w_addr: Pubkey,
    mut attestation_cfg: AttestationConfig,
    metrics_bind_addr: SocketAddr,
) -> Result<(), ErrBox> {
    tokio::spawn(start_metrics_server(metrics_bind_addr));

    info!("Started serving metrics on {}", metrics_bind_addr);

    info!(
        "Crawling mapping {:?} every {} minutes",
        attestation_cfg.mapping_addr, attestation_cfg.mapping_reload_interval_mins
    );

    // Used for easier detection of config changes
    let mut hasher = Sha3_256::new();
    let mut old_sched_futs_state: Option<(JoinHandle<_>, GenericArray<u8, _>)> = None; // (old_futs_handle, old_config_hash)

    // For enforcing min_msg_reuse_interval_ms, we keep a piece of
    // state that creates or reuses accounts if enough time had
    // passed. It is crucial that this queue is reused across mapping
    // lookups, so that previous symbol set's messages have enough
    // time to be picked up by Wormhole guardians.
    let message_q_mtx = Arc::new(Mutex::new(P2WMessageQueue::new(
        Duration::from_millis(attestation_cfg.min_msg_reuse_interval_ms),
        attestation_cfg.max_msg_accounts as usize,
    )));

    // This loop cranks attestations without interruption. This is
    // achieved by spinning up a new up-to-date symbol set before
    // letting go of the previous one. Additionally, hash of on-chain
    // and attestation configs is used to prevent needless reloads of
    // an unchanged symbol set.
    loop {
        let start_time = Instant::now(); // Helps timekeep mapping lookups accurately

        let config = match get_config_account(&lock_and_make_rpc(&rpc_cfg).await, &p2w_addr).await {
            Ok(c) => c,
            Err(e) => {
                error!(
                    "Could not look up latest on-chain config in top-level loop: {:?}",
                    e
                );
                continue;
            }
        };

        // Use the mapping if specified
        if let Some(mapping_addr) = attestation_cfg.mapping_addr.as_ref() {
            match crawl_pyth_mapping(&lock_and_make_rpc(&rpc_cfg).await, mapping_addr).await {
                Ok(additional_accounts) => {
                    debug!(
                        "Crawled mapping {} data:\n{:#?}",
                        mapping_addr, additional_accounts
                    );
                    attestation_cfg.add_symbols(additional_accounts, "mapping".to_owned());
                }
                // De-escalate crawling errors; A temporary failure to
                // look up the mapping should not crash the attester
                Err(e) => {
                    error!("Could not crawl mapping {}: {:?}", mapping_addr, e);
                }
            }
        }
        debug!(
            "Attestation config (includes mapping accounts):\n{:#?}",
            attestation_cfg
        );

        // Hash currently known config
        hasher.update(serde_yaml::to_vec(&attestation_cfg)?);
        hasher.update(borsh::to_vec(&config)?);

        let new_cfg_hash = hasher.finalize_reset();

        if let Some((old_handle, old_cfg_hash)) = old_sched_futs_state.as_ref() {
            // Ignore unchanged configs
            if &new_cfg_hash == old_cfg_hash {
                info!("Note: Attestation config and on-chain config unchanged, not stopping existing attestation sched jobs");
            } else {
                // Process changed config into attestation scheduling futures
                info!("Spinning up attestation sched jobs");
                // Start the new sched futures
                let new_sched_futs_handle = tokio::spawn(prepare_attestation_sched_jobs(
                    &attestation_cfg,
                    &config,
                    &rpc_cfg,
                    &p2w_addr,
                    &payer,
                    message_q_mtx.clone(),
                ));

                // Quit old sched futures
                old_handle.abort();

                // The just started futures become the on-going attestation state
                old_sched_futs_state = Some((new_sched_futs_handle, new_cfg_hash));
            }
        } else {
            // Base case for first attestation attempt
            old_sched_futs_state = Some((
                tokio::spawn(prepare_attestation_sched_jobs(
                    &attestation_cfg,
                    &config,
                    &rpc_cfg,
                    &p2w_addr,
                    &payer,
                    message_q_mtx.clone(),
                )),
                new_cfg_hash,
            ));
        }

        // Sum up elapsed time, wait for next run accurately
        let target = Duration::from_secs(attestation_cfg.mapping_reload_interval_mins * 60);
        let elapsed = start_time.elapsed();

        let remaining = target.saturating_sub(elapsed);

        if remaining == Duration::from_secs(0) {
            warn!(
                "Processing took more than desired mapping lookup interval of {} seconds, not sleeping. Consider increasing {}",
                target.as_secs(),
                // stringify prints the up-to-date setting name automatically
                stringify!(attestation_cfg.mapping_reload_interval_mins)
            );
        } else {
            info!(
                "Processing new mapping took {}.{}s, next config/mapping refresh in {}.{}s",
                elapsed.as_secs(),
                elapsed.subsec_millis(),
                remaining.as_secs(),
                remaining.subsec_millis()
            );
        }

        tokio::time::sleep(remaining).await;
    }
}

#[derive(Clone)]
pub struct RpcCfg {
    pub url:        String,
    pub timeout:    Duration,
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

/// Non-daemon attestation scheduling
async fn handle_attest_non_daemon_mode(
    mut attestation_cfg: AttestationConfig,
    rpc_cfg: Arc<RLMutex<RpcCfg>>,
    p2w_addr: Pubkey,
    payer: Keypair,
    n_retries: usize,
    retry_interval: Duration,
) -> Result<(), ErrBox> {
    let p2w_cfg = get_config_account(&lock_and_make_rpc(&rpc_cfg).await, &p2w_addr).await?;

    // Use the mapping if specified
    if let Some(mapping_addr) = attestation_cfg.mapping_addr.as_ref() {
        match crawl_pyth_mapping(&lock_and_make_rpc(&rpc_cfg).await, mapping_addr).await {
            Ok(additional_accounts) => {
                debug!(
                    "Crawled mapping {} data:\n{:#?}",
                    mapping_addr, additional_accounts
                );
                attestation_cfg.add_symbols(additional_accounts, "mapping".to_owned());
            }
            // De-escalate crawling errors; A temporary failure to
            // look up the mapping should not crash the attester
            Err(e) => {
                error!("Could not crawl mapping {}: {:?}", mapping_addr, e);
            }
        }
    }
    debug!(
        "Attestation config (includes mapping accounts):\n{:#?}",
        attestation_cfg
    );

    let batches = attestation_cfg.as_batches(p2w_cfg.max_batch_size as usize);
    let batch_count = batches.len();

    // For enforcing min_msg_reuse_interval_ms, we keep a piece of
    // state that creates or reuses accounts if enough time had
    // passed
    let message_q_mtx = Arc::new(Mutex::new(P2WMessageQueue::new(
        Duration::from_millis(attestation_cfg.min_msg_reuse_interval_ms),
        attestation_cfg.max_msg_accounts as usize,
    )));

    let retry_jobs = batches.into_iter().enumerate().map(|(idx, batch_state)| {
        attestation_retry_job(AttestationRetryJobArgs {
            batch_no: idx + 1,
            batch_count,
            group_name: batch_state.group_name,
            symbols: batch_state.symbols,
            n_retries,
            retry_interval,
            rpc_cfg: rpc_cfg.clone(),
            p2w_addr,
            p2w_config: p2w_cfg.clone(),
            payer: Keypair::from_bytes(&payer.to_bytes()).unwrap(),
            message_q_mtx: message_q_mtx.clone(),
        })
    });

    let results = futures::future::join_all(retry_jobs).await;

    // After completing, we count any errors coming from the sched
    // futs.
    let errors: Vec<_> = results
        .iter()
        .enumerate()
        .filter_map(|(idx, r)| {
            r.as_ref()
                .err()
                .map(|e| format!("Error {}: {:?}\n", idx + 1, e))
        })
        .collect();

    if !errors.is_empty() {
        let err_lines = errors.join("\n");
        let msg = format!("{} batches failed:\n{}", errors.len(), err_lines);
        error!("{}", msg);
        return Err(msg.into());
    }
    Ok(())
}

/// Constructs attestation scheduling jobs from attestation config.
fn prepare_attestation_sched_jobs(
    attestation_cfg: &AttestationConfig,
    p2w_cfg: &Pyth2WormholeConfig,
    rpc_cfg: &Arc<RLMutex<RpcCfg>>,
    p2w_addr: &Pubkey,
    payer: &Keypair,
    message_q_mtx: Arc<Mutex<P2WMessageQueue>>,
) -> futures::future::JoinAll<impl Future<Output = Result<(), ErrBoxSend>>> {
    info!(
        "{} symbol groups read, dividing into batches",
        attestation_cfg.symbol_groups.len(),
    );

    // Flatten attestation config into a plain list of batches
    let batches: Vec<_> = attestation_cfg.as_batches(p2w_cfg.max_batch_size as usize);

    let batch_count = batches.len();

    // Create attestation scheduling routines; see attestation_sched_job() for details
    let attestation_sched_futs = batches.into_iter().enumerate().map(|(idx, batch)| {
        attestation_sched_job(AttestationSchedJobArgs {
            batch,
            batch_no: idx + 1,
            batch_count,
            rpc_cfg: rpc_cfg.clone(),
            p2w_addr: *p2w_addr,
            config: p2w_cfg.clone(),
            payer: Keypair::from_bytes(&payer.to_bytes()).unwrap(),
            message_q_mtx: message_q_mtx.clone(),
        })
    });

    futures::future::join_all(attestation_sched_futs)
}

/// The argument count on attestation_sched_job got out of hand. This
/// helps keep the correct order in check.
pub struct AttestationSchedJobArgs {
    pub batch:         BatchState,
    pub batch_no:      usize,
    pub batch_count:   usize,
    pub rpc_cfg:       Arc<RLMutex<RpcCfg>>,
    pub p2w_addr:      Pubkey,
    pub config:        Pyth2WormholeConfig,
    pub payer:         Keypair,
    pub message_q_mtx: Arc<Mutex<P2WMessageQueue>>,
}

/// A future that decides how a batch is sent in daemon mode.
///
/// Attestations of the batch are scheduled continuously using
/// spawn(), which means that a next attestation of the same batch
/// begins immediately when a condition is met without waiting for the
/// previous attempt to finish. Subsequent attestations are started
/// according to the attestation_conditions field on the
/// batch. Concurrent requests per batch are limited by the
/// max_batch_jobs field to prevent excess memory usage on network
/// slowdowns etc..
async fn attestation_sched_job(args: AttestationSchedJobArgs) -> Result<(), ErrBoxSend> {
    let AttestationSchedJobArgs {
        mut batch,
        batch_no,
        batch_count,
        rpc_cfg,
        p2w_addr,
        config,
        payer,
        message_q_mtx,
    } = args;

    // Stagger this sched job by batch_no * 10 milliseconds. It
    // mitigates uneven distribution of tx requests which may resolve
    // RPC timeouts on larger interval-based symbol groups.
    tokio::time::sleep(Duration::from_millis(batch_no as u64 * 10)).await;

    // Enforces the max batch job count
    let sema = Arc::new(Semaphore::new(batch.conditions.max_batch_jobs));
    loop {
        debug!(
            "Batch {}/{}, group {:?}: Scheduling attestation job",
            batch_no, batch_count, batch.group_name
        );

        let job = attestation_job(AttestationJobArgs {
            rlmtx: rpc_cfg.clone(),
            batch_no,
            batch_count,
            group_name: batch.group_name.clone(),
            p2w_addr,
            config: config.clone(),
            payer: Keypair::from_bytes(&payer.to_bytes()).unwrap(), // Keypair has no clone
            symbols: batch.symbols.to_vec(),
            max_jobs_sema: sema.clone(),
            message_q_mtx: message_q_mtx.clone(),
        });

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

        let batch_no4err_msg = batch_no;
        let batch_count4err_msg = batch_count;
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

        batch.last_job_finished_at = Instant::now();
    }
}

pub struct AttestationRetryJobArgs {
    pub batch_no:       usize,
    pub batch_count:    usize,
    pub group_name:     String,
    pub symbols:        Vec<P2WSymbol>,
    pub n_retries:      usize,
    pub retry_interval: Duration,
    pub rpc_cfg:        Arc<RLMutex<RpcCfg>>,
    pub p2w_addr:       Pubkey,
    pub p2w_config:     Pyth2WormholeConfig,
    pub payer:          Keypair,
    pub message_q_mtx:  Arc<Mutex<P2WMessageQueue>>,
}

/// A future that cranks a batch up to n_retries times, pausing for
/// retry_interval in between; Used exclusively in non-daemon mode
async fn attestation_retry_job(args: AttestationRetryJobArgs) -> Result<(), ErrBoxSend> {
    let AttestationRetryJobArgs {
        batch_no,
        batch_count,
        group_name,
        symbols,
        n_retries,
        retry_interval,
        rpc_cfg,
        p2w_addr,
        p2w_config,
        payer,
        message_q_mtx,
    } = args;

    let mut res = Err(
        "attestation_retry_job INTERNAL: Could not get a single attestation job result"
            .to_string()
            .into(),
    );

    for _i in 0..=n_retries {
        res = attestation_job(AttestationJobArgs {
            rlmtx: rpc_cfg.clone(),
            batch_no,
            batch_count,
            group_name: group_name.clone(),
            p2w_addr,
            config: p2w_config.clone(),
            payer: Keypair::from_bytes(&payer.to_bytes()).unwrap(), // Keypair has no clone
            symbols: symbols.clone(),
            max_jobs_sema: Arc::new(Semaphore::new(1)), // Not important for non-daemon mode
            message_q_mtx: message_q_mtx.clone(),
        })
        .await;

        // Finish early on success
        if res.is_ok() {
            break;
        }

        tokio::time::sleep(retry_interval).await;
    }

    res
}

/// Arguments for attestation_job(). This struct rules out same-type
/// ordering errors due to the large argument count
pub struct AttestationJobArgs {
    pub rlmtx:         Arc<RLMutex<RpcCfg>>,
    pub batch_no:      usize,
    pub batch_count:   usize,
    pub group_name:    String,
    pub p2w_addr:      Pubkey,
    pub config:        Pyth2WormholeConfig,
    pub payer:         Keypair,
    pub symbols:       Vec<P2WSymbol>,
    pub max_jobs_sema: Arc<Semaphore>,
    pub message_q_mtx: Arc<Mutex<P2WMessageQueue>>,
}

/// A future for a single attempt to attest a batch on Solana.
async fn attestation_job(args: AttestationJobArgs) -> Result<(), ErrBoxSend> {
    let AttestationJobArgs {
        rlmtx,
        batch_no,
        batch_count,
        group_name,
        p2w_addr,
        config,
        payer,
        symbols,
        max_jobs_sema,
        message_q_mtx,
    } = args;

    // Will be dropped after attestation is complete
    let _permit = max_jobs_sema.acquire().await?;

    debug!(
        "Batch {}/{}, group {:?}: Starting attestation job",
        batch_no, batch_count, group_name
    );
    let rpc = lock_and_make_rpc(&rlmtx).await; // Reuse the same lock for the blockhash/tx/get_transaction
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
                encoding:                          Some(UiTransactionEncoding::Json),
                commitment:                        Some(rpc.commitment()),
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
        .ok_or_else(|| -> ErrBoxSend { "No seqno in program logs".to_string().into() })?;

    info!(
        "Batch {}/{}, group {:?} OK. Sequence: {}",
        batch_no, batch_count, group_name, seqno
    );
    ATTESTATIONS_OK_CNT.inc();
    LAST_SEQNO_GAUGE.set(seqno.parse::<i64>()?);
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
