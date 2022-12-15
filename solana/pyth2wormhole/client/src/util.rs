use {
    crate::HEALTHCHECK_STATE,
    http::status::StatusCode,
    log::{
        error,
        trace,
    },
    prometheus::TextEncoder,
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
    tokio::sync::{
        Mutex,
        MutexGuard,
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
        // Unhealthy - 503 Service Unavailable
        Some(false) => {
            let msg = format!(
                "unhealthy, all of {} latest attestations returned error",
                hc_state.max_window_size
            );
            Ok(reply::with_status(msg, StatusCode::SERVICE_UNAVAILABLE))
        }
        // No data - 307 Temporary Redirect
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
            Ok(reply::with_status(msg, StatusCode::TEMPORARY_REDIRECT))
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
