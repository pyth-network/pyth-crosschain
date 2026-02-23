//! Push loop: receives prices from Lazer, batches, and pushes to validators.
//!
//! HA: Multiple uncoordinated pushers share an oracle account but have
//! different signing keys. Validators deduplicate by (account, nonce).

use crate::bulk_client::BulkClient;
use crate::config::{load_signing_key, Config};
use crate::metrics::{self, base_metrics, ws_metrics};
use crate::signing::{ActionType, BulkSigner, OracleAction, OracleUpdate};
use anyhow::{Context as _, Result};
use pusher_base::{CachedPrice, LazerReceiver};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::interval;
use tracing::{debug, error, info, warn};
use pusher_base::AppRuntime;

pub async fn run(config: Config, runtime: AppRuntime) -> Result<()> {
    info!("initializing bulk-trade-pusher");

    let signing_key = load_signing_key(&config.bulk.signing_key_path)?;
    let signer = BulkSigner::from_base58(&signing_key).context("failed to initialize signer")?;
    info!(
        signer_pubkey = signer.pubkey_base58(),
        oracle_account = %config.bulk.oracle_account_pubkey_base58,
        "initialized signer"
    );

    let bulk_client = BulkClient::start(&config.bulk, ws_metrics(), runtime.clone())
        .await
        .context("failed to start Bulk client")?;
    info!("started Bulk client");

    let receiver = LazerReceiver::start(
        &config.base.lazer,
        &config.base.feeds,
        Some(base_metrics()),
        runtime.clone(),
    )
    .await
    .context("failed to start Lazer receiver")?;

    run_push_loop(
        config.base.feeds.update_interval,
        receiver,
        signer,
        bulk_client,
        &config.bulk.oracle_account_pubkey_base58,
        runtime,
    )
    .await
}

async fn run_push_loop(
    update_interval: Duration,
    receiver: LazerReceiver,
    signer: BulkSigner,
    bulk_client: BulkClient,
    oracle_account: &str,
    runtime: AppRuntime,
) -> Result<()> {
    info!(
        update_interval_ms = update_interval.as_millis(),
        "starting push loop"
    );

    let mut interval = interval(update_interval);

    loop {
        tokio::select! {
            _ = runtime.cancelled() => {
                info!("push loop shutdown requested");
                return Ok(());
            }
            _ = interval.tick() => {}
        }

        if !bulk_client.is_running() {
            error!("Bulk client stopped unexpectedly");
            anyhow::bail!("Bulk client stopped");
        }
        if !receiver.is_running() {
            error!("Lazer receiver stopped unexpectedly");
            anyhow::bail!("Lazer receiver stopped");
        }

        let prices: Vec<CachedPrice> = {
            let cache = receiver.price_cache().read().await;
            receiver
                .feed_registry()
                .feed_ids()
                .filter_map(|id| cache.get(id).cloned())
                .collect()
        };

        if prices.is_empty() {
            debug!("no prices available, skipping push");
            continue;
        }

        let oracles: Vec<OracleUpdate> = prices
            .iter()
            .filter_map(|cached| {
                let price = cached.data.price.as_ref()?;
                let exponent = cached.data.exponent?;
                Some(OracleUpdate {
                    t: cached.timestamp_ms,
                    price_feed_id: cached.feed_id.0,
                    px: price.mantissa_i64(),
                    expo: exponent,
                })
            })
            .collect();

        if oracles.is_empty() {
            debug!("no valid prices to push");
            continue;
        }

        metrics::set_batch_size(oracles.len());

        #[allow(
            clippy::cast_possible_truncation,
            reason = "nanoseconds timestamp fits in u64 for many years"
        )]
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0);

        let action = OracleAction {
            action_type: ActionType::PythOracle,
            oracles,
            nonce,
        };

        let tx = match signer.sign_transaction(action, oracle_account) {
            Ok(tx) => tx,
            Err(e) => {
                error!(?e, "failed to sign transaction");
                continue;
            }
        };

        if !bulk_client.push(tx) {
            warn!("failed to queue transaction (queue full)");
        }
    }
}
