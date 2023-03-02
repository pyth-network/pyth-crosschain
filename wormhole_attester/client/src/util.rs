use {
    crate::HEALTHCHECK_STATE,
    http::status::StatusCode,
    log::{
        error,
        trace,
    },
    prometheus::TextEncoder,
    solana_client::{
        client_error::Result as SolClientResult,
        nonblocking::rpc_client::RpcClient,
        rpc_config::RpcSendTransactionConfig,
        rpc_request::RpcError,
    },
    solana_sdk::{
        commitment_config::CommitmentConfig,
        signature::Signature,
        transaction::{
            uses_durable_nonce,
            Transaction,
        },
    },
    std::{
        net::SocketAddr,
        ops::{
            Deref,
            DerefMut,
        },
        time::{
            Duration,
            Instant,
        },
    },
    tokio::{
        sync::{
            Mutex,
            MutexGuard,
        },
        time::sleep,
    },
    warp::{
        reply,
        Filter,
        Rejection,
        Reply,
    },
};

/// Rate-limited mutex. Ensures there's a period of minimum rl_interval between lock acquisitions
pub struct RLMutex<T> {
    mtx:         Mutex<RLMutexState<T>>,
    rl_interval: Duration,
}

/// Helper to make the last_released writes also guarded by the mutex
pub struct RLMutexState<T> {
    /// Helps make sure regular passage of time is subtracted from sleep duration
    last_released: Instant,
    val:           T,
}

impl<T> Deref for RLMutexState<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self.val
    }
}

impl<T> DerefMut for RLMutexState<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.val
    }
}

/// Helper wrapper to record lock release times via Drop
pub struct RLMutexGuard<'a, T> {
    guard: MutexGuard<'a, RLMutexState<T>>,
}

impl<'a, T> Drop for RLMutexGuard<'a, T> {
    fn drop(&mut self) {
        let state: &mut RLMutexState<T> =
            MutexGuard::<'a, RLMutexState<T>>::deref_mut(&mut self.guard);
        state.last_released = Instant::now();
    }
}

impl<'a, T> Deref for RLMutexGuard<'a, T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        self.guard.deref()
    }
}

impl<'a, T> DerefMut for RLMutexGuard<'a, T> {
    fn deref_mut(&mut self) -> &mut T {
        self.guard.deref_mut()
    }
}

impl<T> RLMutex<T> {
    pub fn new(val: T, rl_interval: Duration) -> Self {
        Self {
            mtx: Mutex::new(RLMutexState {
                last_released: Instant::now().checked_sub(rl_interval).unwrap(),
                val,
            }),
            rl_interval,
        }
    }

    pub async fn lock(&self) -> RLMutexGuard<'_, T> {
        let guard = self.mtx.lock().await;
        let elapsed = guard.last_released.elapsed();
        if elapsed < self.rl_interval {
            let sleep_time = self.rl_interval - elapsed;
            trace!(
                "RLMutex: Parking lock future for {}.{}s",
                sleep_time.as_secs(),
                sleep_time.subsec_millis()
            );

            tokio::time::sleep(sleep_time).await;
        }

        RLMutexGuard { guard }
    }
}

async fn metrics_handler() -> Result<impl Reply, Rejection> {
    let encoder = TextEncoder::new();
    match encoder.encode_to_string(&prometheus::gather()) {
        Ok(encoded_metrics) => Ok(reply::with_status(encoded_metrics, StatusCode::OK)),
        Err(e) => {
            error!("Could not serve metrics: {}", e.to_string());
            Ok(reply::with_status(
                "".to_string(),
                StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

/// Shares healthcheck result via HTTP status codes. The idea is to
/// get a yes/no health answer using a plain HTTP request. Note: Curl
/// does not treat 3xx statuses as errors by default.
async fn healthcheck_handler() -> Result<impl Reply, Rejection> {
    let hc_state = HEALTHCHECK_STATE.lock().await;
    match hc_state.is_healthy() {
        // Healthy - 200 OK
        Some(true) => {
            let ok_count = hc_state
                .window
                .iter()
                .fold(0usize, |acc, val| if *val { acc + 1 } else { acc });
            let msg = format!(
                "healthy, {} of {} last attestations OK",
                ok_count, hc_state.max_window_size
            );
            Ok(reply::with_status(msg, StatusCode::OK))
        }
        // Unhealthy - 500 Internal Server Error
        Some(false) => {
            let msg = format!(
                "unhealthy, all of {} latest attestations returned error",
                hc_state.max_window_size
            );
            Ok(reply::with_status(msg, StatusCode::INTERNAL_SERVER_ERROR))
        }
        // No data - 503 Service Unavailable
        None => {
            let msg = if hc_state.enable {
                format!(
                    "Not enough data in window, {} of {} min attempts made",
                    hc_state.window.len(),
                    hc_state.max_window_size
                )
            } else {
                "Healthcheck disabled (enable_healthcheck is false)".to_string()
            };
            Ok(reply::with_status(msg, StatusCode::SERVICE_UNAVAILABLE))
        }
    }
}

/// Serves Prometheus metrics and the result of the healthcheck
pub async fn start_metrics_server(addr: impl Into<SocketAddr> + 'static) {
    let metrics_route = warp::path("metrics") // The Prometheus metrics subpage is standardized to always be /metrics
        .and(warp::path::end())
        .and_then(metrics_handler);
    let healthcheck_route = warp::path("healthcheck")
        .and(warp::path::end())
        .and_then(healthcheck_handler);

    warp::serve(metrics_route.or(healthcheck_route))
        .bind(addr)
        .await;
}

/// WARNING: Copied verbatim from v1.10.31, be careful when bumping
/// solana crate versions!
///
/// TODO(2023-03-02): Use an upstream method when
/// it's available.
///
/// This method is almost identical to
/// RpcClient::send_and_confirm_transaction(). The only difference is
/// that we let the user specify the config and replace
/// send_transaction() inside with
/// send_transaction_with_config(). This variant is currently missing
/// from solana_client.
pub async fn send_and_confirm_transaction_with_config(
    client: &RpcClient,
    transaction: &Transaction,
    config: RpcSendTransactionConfig,
) -> SolClientResult<Signature> {
    const SEND_RETRIES: usize = 1;
    const GET_STATUS_RETRIES: usize = usize::MAX;

    'sending: for _ in 0..SEND_RETRIES {
        let signature = client
            .send_transaction_with_config(transaction, config)
            .await?;

        let recent_blockhash = if uses_durable_nonce(transaction).is_some() {
            let (recent_blockhash, ..) = client
                .get_latest_blockhash_with_commitment(CommitmentConfig::processed())
                .await?;
            recent_blockhash
        } else {
            transaction.message.recent_blockhash
        };

        for status_retry in 0..GET_STATUS_RETRIES {
            match client.get_signature_status(&signature).await? {
                Some(Ok(_)) => return Ok(signature),
                Some(Err(e)) => return Err(e.into()),
                None => {
                    if !client
                        .is_blockhash_valid(&recent_blockhash, CommitmentConfig::processed())
                        .await?
                    {
                        // Block hash is not found by some reason
                        break 'sending;
                    } else if cfg!(not(test))
                            // Ignore sleep at last step.
                            && status_retry < GET_STATUS_RETRIES
                    {
                        // Retry twice a second
                        sleep(Duration::from_millis(500)).await;

                        continue;
                    }
                }
            }
        }
    }

    Err(RpcError::ForUser(
        "unable to confirm transaction. \
             This can happen in situations such as transaction expiration \
             and insufficient fee-payer funds"
            .to_string(),
    )
    .into())
}
