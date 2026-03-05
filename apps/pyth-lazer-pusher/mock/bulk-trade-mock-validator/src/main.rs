//! Mock Bulk Trade validator for testing.
//!
//! Accepts WebSocket connections and responds to oracle push messages.
//! Exposes Prometheus metrics on a separate port.
//!
//! Usage:
//!   cargo run --bin mock-bulk-validator -- --port 8080 --metrics-port 9090
//!   cargo run --bin mock-bulk-validator -- --port 8080 --fail-rate 0.1 --dedup-rate 0.2

use anyhow::Result;
use clap::Parser;
use futures_util::{SinkExt, StreamExt};
use prometheus::{
    Counter, CounterVec, Gauge, GaugeVec, HistogramOpts, HistogramVec, Opts, Registry,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{debug, error, info, warn};

#[derive(Parser)]
#[command(name = "mock-bulk-validator")]
#[command(about = "Mock Bulk Trade validator for testing")]
struct Args {
    /// Port to listen on for WebSocket connections
    #[arg(short, long, default_value = "8080")]
    port: u16,

    /// Port for Prometheus metrics
    #[arg(long, default_value = "9090")]
    metrics_port: u16,

    /// Rate of simulated failures (0.0 - 1.0)
    #[arg(long, default_value = "0.0")]
    fail_rate: f64,

    /// Rate of simulated deduplication responses (0.0 - 1.0)
    #[arg(long, default_value = "0.0")]
    dedup_rate: f64,

    /// Deduplication window in milliseconds.
    /// If an account+feed receives an update within this window, subsequent updates are deduplicated.
    /// Set to 0 to disable time-based dedup (only nonce dedup).
    #[arg(long, default_value = "100")]
    dedup_window_ms: u64,

    /// Log received transactions
    #[arg(long, default_value = "false")]
    verbose: bool,

    /// Validator instance name (for metrics)
    #[arg(long, default_value = "validator-1")]
    instance: String,
}

/// Incoming request wrapper from pusher
#[derive(Debug, Clone, Deserialize)]
struct BulkRequest {
    #[allow(dead_code, reason = "required for serde deserialization")]
    method: String,
    request: BulkRequestPayload,
    id: u64,
}

#[derive(Debug, Clone, Deserialize)]
struct BulkRequestPayload {
    #[allow(dead_code, reason = "required for serde deserialization")]
    #[serde(rename = "type")]
    payload_type: String,
    payload: OracleTransaction,
}

/// Oracle transaction inside the request
#[derive(Debug, Clone, Deserialize)]
struct OracleTransaction {
    action: OracleAction,
    account: String,
    signer: String,
    #[allow(dead_code, reason = "required for serde deserialization")]
    signature: String,
}

#[derive(Debug, Clone, Deserialize)]
struct OracleAction {
    #[allow(dead_code, reason = "required for serde deserialization")]
    #[serde(rename = "type")]
    action_type: String,
    oracles: Vec<OracleUpdate>,
    #[allow(dead_code, reason = "used for logging only when verbose")]
    nonce: u64,
}

#[derive(Debug, Clone, Deserialize)]
struct OracleUpdate {
    t: u64,
    #[serde(rename = "fi")]
    price_feed_id: u32,
    px: i64,
    #[serde(rename = "ex")]
    expo: i16,
}

/// Response to send back
#[derive(Debug, Clone, Serialize)]
struct BulkResponse {
    #[serde(rename = "type")]
    response_type: String,
    id: u64,
    data: BulkResponseData,
}

#[derive(Debug, Clone, Serialize)]
struct BulkResponseData {
    #[serde(rename = "type")]
    data_type: String,
    payload: BulkResponsePayload,
}

#[derive(Debug, Clone, Serialize)]
struct BulkResponsePayload {
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

/// Metrics for the mock validator
struct Metrics {
    /// Total requests received
    requests_received: Counter,
    /// Messages by result status
    messages_by_status: CounterVec,
    /// Messages by signer
    messages_by_signer: CounterVec,
    /// Processing latency
    processing_latency: HistogramVec,
    /// Active connections
    active_connections: Gauge,
    /// Last price by feed ID
    last_price: GaugeVec,
    /// Last update timestamp by feed ID
    last_update_ts: GaugeVec,
    /// Total unique signers seen
    unique_signers: Gauge,
}

impl Metrics {
    fn new(instance: &str) -> Result<Self> {
        let instance_label: HashMap<String, String> =
            [("instance".to_string(), instance.to_string())]
                .into_iter()
                .collect();

        Ok(Self {
            requests_received: Counter::with_opts(
                Opts::new(
                    "validator_requests_received_total",
                    "Total requests received",
                )
                .const_labels(instance_label.clone()),
            )?,
            messages_by_status: CounterVec::new(
                Opts::new(
                    "validator_messages_by_status_total",
                    "Messages by result status",
                )
                .const_labels(instance_label.clone()),
                &["status"],
            )?,
            messages_by_signer: CounterVec::new(
                Opts::new("validator_messages_by_signer_total", "Messages by signer")
                    .const_labels(instance_label.clone()),
                &["signer"],
            )?,
            processing_latency: HistogramVec::new(
                HistogramOpts::new(
                    "validator_processing_latency_seconds",
                    "Message processing latency",
                )
                .const_labels(instance_label.clone())
                .buckets(vec![0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1]),
                &[],
            )?,
            active_connections: Gauge::with_opts(
                Opts::new(
                    "validator_active_connections",
                    "Number of active WebSocket connections",
                )
                .const_labels(instance_label.clone()),
            )?,
            last_price: GaugeVec::new(
                Opts::new("validator_last_price", "Last received price by feed ID")
                    .const_labels(instance_label.clone()),
                &["feed_id"],
            )?,
            last_update_ts: GaugeVec::new(
                Opts::new(
                    "validator_last_update_timestamp",
                    "Last update timestamp by feed ID",
                )
                .const_labels(instance_label.clone()),
                &["feed_id"],
            )?,
            unique_signers: Gauge::with_opts(
                Opts::new("validator_unique_signers", "Number of unique signers seen")
                    .const_labels(instance_label),
            )?,
        })
    }

    fn register(&self, registry: &Registry) -> Result<()> {
        registry.register(Box::new(self.requests_received.clone()))?;
        registry.register(Box::new(self.messages_by_status.clone()))?;
        registry.register(Box::new(self.messages_by_signer.clone()))?;
        registry.register(Box::new(self.processing_latency.clone()))?;
        registry.register(Box::new(self.active_connections.clone()))?;
        registry.register(Box::new(self.last_price.clone()))?;
        registry.register(Box::new(self.last_update_ts.clone()))?;
        registry.register(Box::new(self.unique_signers.clone()))?;
        Ok(())
    }
}

/// Shared state for the validator
struct ValidatorState {
    /// Track (account, nonce) pairs for nonce-based deduplication
    seen_nonces: RwLock<HashSet<(String, u64)>>,
    /// Track (account, feed_id) -> last update time for time-based deduplication
    last_update_times: RwLock<HashMap<(String, u32), Instant>>,
    /// Track unique signers
    seen_signers: RwLock<HashSet<String>>,
    /// Track prices: feed_id -> (price, timestamp)
    prices: RwLock<HashMap<String, (f64, u64)>>,
    /// Active connection count
    connection_count: AtomicU64,
}

impl ValidatorState {
    fn new() -> Self {
        Self {
            seen_nonces: RwLock::new(HashSet::new()),
            last_update_times: RwLock::new(HashMap::new()),
            seen_signers: RwLock::new(HashSet::new()),
            prices: RwLock::new(HashMap::new()),
            connection_count: AtomicU64::new(0),
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Exit on panic in any task
    std::panic::set_hook(Box::new(|info| {
        eprintln!("PANIC: {info}");
        std::process::exit(1);
    }));

    #[allow(
        clippy::expect_used,
        reason = "static string directive cannot fail to parse"
    )]
    let log_directive = "mock_bulk_validator=debug"
        .parse()
        .expect("valid log directive");

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env().add_directive(log_directive),
        )
        .init();

    let args = Args::parse();

    // Initialize metrics
    let metrics = Arc::new(Metrics::new(&args.instance)?);
    metrics.register(prometheus::default_registry())?;

    // Start metrics server
    let metrics_addr: SocketAddr = ([0, 0, 0, 0], args.metrics_port).into();
    prometheus_exporter::start(metrics_addr)?;
    info!(
        "Metrics server listening on http://{}/metrics",
        metrics_addr
    );

    // Initialize state
    let state = Arc::new(ValidatorState::new());

    // Start WebSocket server
    let ws_addr = SocketAddr::from(([0, 0, 0, 0], args.port));
    let listener = TcpListener::bind(&ws_addr).await?;

    info!("Mock Bulk Trade validator listening on ws://{}", ws_addr);
    info!(
        "Settings: instance={}, fail_rate={}, dedup_rate={}, dedup_window_ms={}, verbose={}",
        args.instance, args.fail_rate, args.dedup_rate, args.dedup_window_ms, args.verbose
    );

    let dedup_window = Duration::from_millis(args.dedup_window_ms);

    loop {
        let (stream, peer_addr) = listener.accept().await?;
        info!("New connection from {}", peer_addr);

        let state = state.clone();
        let metrics = metrics.clone();
        let fail_rate = args.fail_rate;
        let dedup_rate = args.dedup_rate;
        let verbose = args.verbose;

        tokio::spawn(async move {
            // Track connection
            state.connection_count.fetch_add(1, Ordering::Relaxed);
            metrics
                .active_connections
                .set(state.connection_count.load(Ordering::Relaxed) as f64);

            let result = handle_connection(
                stream,
                peer_addr,
                state.clone(),
                metrics.clone(),
                fail_rate,
                dedup_rate,
                dedup_window,
                verbose,
            )
            .await;

            // Untrack connection
            state.connection_count.fetch_sub(1, Ordering::Relaxed);
            metrics
                .active_connections
                .set(state.connection_count.load(Ordering::Relaxed) as f64);

            if let Err(e) = result {
                error!("Connection error from {}: {}", peer_addr, e);
            }
        });
    }
}

#[allow(clippy::too_many_arguments, reason = "mock validator test code")]
async fn handle_connection(
    stream: TcpStream,
    peer_addr: SocketAddr,
    state: Arc<ValidatorState>,
    metrics: Arc<Metrics>,
    fail_rate: f64,
    dedup_rate: f64,
    dedup_window: Duration,
    verbose: bool,
) -> Result<()> {
    let ws_stream = accept_async(stream).await?;
    let (mut write, mut read) = ws_stream.split();

    info!("[{}] WebSocket connection established", peer_addr);

    while let Some(msg) = read.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                warn!("[{}] Read error: {}", peer_addr, e);
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                let start = Instant::now();
                let response = process_message(
                    &text,
                    &state,
                    &metrics,
                    fail_rate,
                    dedup_rate,
                    dedup_window,
                    verbose,
                    peer_addr,
                )
                .await;
                metrics
                    .processing_latency
                    .with_label_values(&[])
                    .observe(start.elapsed().as_secs_f64());

                let response_json = serde_json::to_string(&response)?;
                write.send(Message::Text(response_json.into())).await?;
            }
            Message::Binary(data) => {
                debug!(
                    "[{}] Received binary message ({} bytes)",
                    peer_addr,
                    data.len()
                );
                if let Ok(text) = String::from_utf8(data.to_vec()) {
                    let start = Instant::now();
                    let response = process_message(
                        &text,
                        &state,
                        &metrics,
                        fail_rate,
                        dedup_rate,
                        dedup_window,
                        verbose,
                        peer_addr,
                    )
                    .await;
                    metrics
                        .processing_latency
                        .with_label_values(&[])
                        .observe(start.elapsed().as_secs_f64());

                    let response_json = serde_json::to_string(&response)?;
                    write.send(Message::Text(response_json.into())).await?;
                }
            }
            Message::Ping(data) => {
                debug!("[{}] Ping received", peer_addr);
                write.send(Message::Pong(data)).await?;
            }
            Message::Pong(_) => {
                debug!("[{}] Pong received", peer_addr);
            }
            Message::Close(_) => {
                info!("[{}] Connection closed by client", peer_addr);
                break;
            }
            Message::Frame(_) => {}
        }
    }

    info!("[{}] Connection closed", peer_addr);
    Ok(())
}

#[allow(clippy::too_many_arguments, reason = "mock validator test code")]
async fn process_message(
    text: &str,
    state: &ValidatorState,
    metrics: &Metrics,
    fail_rate: f64,
    dedup_rate: f64,
    dedup_window: Duration,
    verbose: bool,
    peer_addr: SocketAddr,
) -> BulkResponse {
    // Parse the request wrapper
    let request: BulkRequest = match serde_json::from_str(text) {
        Ok(req) => req,
        Err(e) => {
            warn!("[{peer_addr}] Failed to parse message: {e}");
            debug!("[{peer_addr}] Raw message: {text}");
            metrics
                .messages_by_status
                .with_label_values(&["parse_error"])
                .inc();
            return BulkResponse {
                response_type: "post".to_string(),
                id: 0,
                data: BulkResponseData {
                    data_type: "action".to_string(),
                    payload: BulkResponsePayload {
                        status: "error".to_string(),
                        message: Some(format!("Invalid JSON: {e}")),
                    },
                },
            };
        }
    };

    // Log the full request as pretty JSON for debugging
    if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(text) {
        if let Ok(pretty) = serde_json::to_string_pretty(&json_value) {
            info!("[{peer_addr}] Received request:\n{pretty}");
        }
    }

    let request_id = request.id;
    let tx = request.request.payload;
    let now = Instant::now();

    // Track signer
    {
        let mut signers = state.seen_signers.write().await;
        signers.insert(tx.signer.clone());
        metrics.unique_signers.set(signers.len() as f64);
    }

    // Truncate signer for metric label (first 8 chars)
    let signer_short: String = tx.signer.chars().take(8).collect();
    metrics
        .messages_by_signer
        .with_label_values(&[&signer_short])
        .inc();

    // Count requests received (before dedup checks)
    metrics.requests_received.inc();

    if verbose {
        info!(
            "[{peer_addr}] Received oracle update: account={}, signer={}, nonce={}, feeds={}",
            tx.account,
            tx.signer,
            tx.action.nonce,
            tx.action.oracles.len()
        );
        for oracle in &tx.action.oracles {
            let price = (oracle.px as f64) * 10_f64.powi(i32::from(oracle.expo));
            info!(
                "[{peer_addr}]   feed_id={} @ {price} (px={}, expo={})",
                oracle.price_feed_id, oracle.px, oracle.expo
            );
        }
    }

    // Check 1: Nonce-based deduplication (account, nonce) pairs
    {
        let nonce_key = (tx.account.clone(), tx.action.nonce);
        let mut seen_nonces = state.seen_nonces.write().await;
        if seen_nonces.contains(&nonce_key) {
            info!(
                "[{peer_addr}] Deduplicated: nonce {} already seen for account {}",
                tx.action.nonce, tx.account
            );
            metrics
                .messages_by_status
                .with_label_values(&["dedup_nonce"])
                .inc();
            return BulkResponse {
                response_type: "post".to_string(),
                id: request_id,
                data: BulkResponseData {
                    data_type: "action".to_string(),
                    payload: BulkResponsePayload {
                        status: "error".to_string(),
                        message: Some("duplicate nonce".to_string()),
                    },
                },
            };
        }
        seen_nonces.insert(nonce_key);
    }

    // Check 2: Time-based deduplication (account, feed_id) within window
    // If ANY feed in this update was already updated within the window, reject the whole update
    if !dedup_window.is_zero() {
        let mut last_updates = state.last_update_times.write().await;
        for oracle in &tx.action.oracles {
            let key = (tx.account.clone(), oracle.price_feed_id);
            if let Some(last_time) = last_updates.get(&key) {
                if now.duration_since(*last_time) < dedup_window {
                    info!(
                        "[{peer_addr}] Deduplicated: feed {} for account {} updated {}ms ago (window={}ms)",
                        oracle.price_feed_id,
                        tx.account,
                        now.duration_since(*last_time).as_millis(),
                        dedup_window.as_millis()
                    );
                    metrics
                        .messages_by_status
                        .with_label_values(&["dedup_time"])
                        .inc();
                    return BulkResponse {
                        response_type: "post".to_string(),
                        id: request_id,
                        data: BulkResponseData {
                            data_type: "action".to_string(),
                            payload: BulkResponsePayload {
                                status: "error".to_string(),
                                message: Some("duplicate update within time window".to_string()),
                            },
                        },
                    };
                }
            }
        }
        // Update timestamps for all feeds in this update
        for oracle in &tx.action.oracles {
            let key = (tx.account.clone(), oracle.price_feed_id);
            last_updates.insert(key, now);
        }
    }

    // Update prices after passing dedup checks
    {
        let mut prices = state.prices.write().await;
        for oracle in &tx.action.oracles {
            let price = (oracle.px as f64) * 10_f64.powi(i32::from(oracle.expo));
            let feed_id_str = oracle.price_feed_id.to_string();
            prices.insert(feed_id_str.clone(), (price, oracle.t));

            metrics
                .last_price
                .with_label_values(&[&feed_id_str])
                .set(price);
            metrics
                .last_update_ts
                .with_label_values(&[&feed_id_str])
                .set(oracle.t as f64);
        }
    }

    // Simulate random deduplication (for chaos testing)
    if dedup_rate > 0.0 && rand::random::<f64>() < dedup_rate {
        info!("[{peer_addr}] Simulated random deduplication");
        metrics
            .messages_by_status
            .with_label_values(&["dedup_random"])
            .inc();
        return BulkResponse {
            response_type: "post".to_string(),
            id: request_id,
            data: BulkResponseData {
                data_type: "action".to_string(),
                payload: BulkResponsePayload {
                    status: "error".to_string(),
                    message: Some("duplicate nonce".to_string()),
                },
            },
        };
    }

    // Simulate random failures (for chaos testing)
    if fail_rate > 0.0 && rand::random::<f64>() < fail_rate {
        warn!("[{peer_addr}] Simulated failure");
        metrics
            .messages_by_status
            .with_label_values(&["error"])
            .inc();
        return BulkResponse {
            response_type: "post".to_string(),
            id: request_id,
            data: BulkResponseData {
                data_type: "action".to_string(),
                payload: BulkResponsePayload {
                    status: "error".to_string(),
                    message: Some("Simulated error".to_string()),
                },
            },
        };
    }

    // Success
    debug!("[{peer_addr}] Accepted");
    metrics
        .messages_by_status
        .with_label_values(&["accepted"])
        .inc();
    BulkResponse {
        response_type: "post".to_string(),
        id: request_id,
        data: BulkResponseData {
            data_type: "action".to_string(),
            payload: BulkResponsePayload {
                status: "ok".to_string(),
                message: None,
            },
        },
    }
}
