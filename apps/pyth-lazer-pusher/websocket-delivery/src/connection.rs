//! WebSocket connection with auto-reconnect.

use crate::metrics::DeliveryMetrics;
use futures_util::{SinkExt, StreamExt};
use pusher_utils::AppRuntime;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{debug, error, info, trace, warn};
use url::Url;

#[derive(Debug, Error)]
enum DisconnectReason {
    #[error("send error")]
    SendError,
    #[error("incoming channel closed")]
    IncomingChannelClosed,
    #[error("received close frame")]
    ReceivedCloseFrame,
    #[error("read error")]
    ReadError,
    #[error("connection closed")]
    ConnectionClosed,
    #[error("marked disconnected")]
    MarkedDisconnected,
    #[error("ping timeout")]
    PingTimeout,
    #[error("ping send error")]
    PingSendError,
    #[error("shutdown requested")]
    Shutdown,
}

#[derive(Debug, Clone)]
pub struct ConnectionConfig {
    pub send_buffer_size: usize,
    pub recv_buffer_size: usize,
    pub ping_interval: Option<Duration>,
    pub ping_timeout: Duration,
    pub auto_reconnect: bool,
    pub reconnect_delay_initial: Duration,
    pub reconnect_delay_max: Duration,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            send_buffer_size: 1000,
            recv_buffer_size: 1000,
            ping_interval: Some(Duration::from_secs(1)),
            ping_timeout: Duration::from_secs(10),
            auto_reconnect: true,
            reconnect_delay_initial: Duration::from_millis(100),
            reconnect_delay_max: Duration::from_secs(2),
        }
    }
}

#[derive(Debug, Clone)]
pub struct IncomingMessage {
    pub endpoint: Url,
    pub text: String,
}

struct PingState {
    last_ping_nanos: AtomicU64,
    epoch: Instant,
}

impl PingState {
    fn new() -> Self {
        Self {
            last_ping_nanos: AtomicU64::new(0),
            epoch: Instant::now(),
        }
    }

    #[allow(
        clippy::cast_possible_truncation,
        reason = "u64 nanos can represent ~584 years, connection won't last that long"
    )]
    fn record_ping_sent(&self) {
        let nanos = self.epoch.elapsed().as_nanos() as u64;
        self.last_ping_nanos.store(nanos, Ordering::SeqCst);
    }

    #[allow(
        clippy::cast_possible_truncation,
        reason = "u64 nanos can represent ~584 years, connection won't last that long"
    )]
    fn get_ping_latency(&self) -> Option<Duration> {
        let sent_nanos = self.last_ping_nanos.swap(0, Ordering::SeqCst);
        if sent_nanos == 0 {
            return None;
        }
        let now_nanos = self.epoch.elapsed().as_nanos() as u64;
        Some(Duration::from_nanos(now_nanos.saturating_sub(sent_nanos)))
    }
}

/// WebSocket connection with ping/pong heartbeat and auto-reconnect.
pub struct Connection {
    endpoint: Url,
    config: ConnectionConfig,
    tx: Option<mpsc::Sender<Message>>,
    connected: Arc<AtomicBool>,
    metrics: Option<DeliveryMetrics>,
}

impl Connection {
    pub fn new(endpoint: Url) -> Self {
        Self::with_config(endpoint, ConnectionConfig::default())
    }

    pub fn with_config(endpoint: Url, config: ConnectionConfig) -> Self {
        Self {
            endpoint,
            config,
            tx: None,
            connected: Arc::new(AtomicBool::new(false)),
            metrics: None,
        }
    }

    pub fn with_metrics(mut self, metrics: DeliveryMetrics) -> Self {
        self.metrics = Some(metrics);
        self
    }

    pub fn endpoint(&self) -> &Url {
        &self.endpoint
    }

    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }

    /// Start connection manager. Spawns background task with auto-reconnect.
    pub fn start(&mut self, incoming_tx: mpsc::Sender<IncomingMessage>, runtime: AppRuntime) {
        info!(endpoint = %self.endpoint, "starting connection manager");

        // Create channel for outgoing messages
        let (tx_send, tx_recv) = mpsc::channel::<Message>(self.config.send_buffer_size);

        // Spawn the connection manager task (tracked for graceful shutdown)
        let endpoint = self.endpoint.clone();
        let config = self.config.clone();
        let connected = self.connected.clone();
        let metrics = self.metrics.clone();
        let runtime_clone = runtime.clone();

        runtime.spawn(async move {
            run_connection_manager(
                tx_recv,
                incoming_tx,
                endpoint,
                config,
                connected,
                metrics,
                runtime_clone,
            )
            .await;
        });

        self.tx = Some(tx_send);
    }

    pub async fn send(&self, text: String) -> bool {
        let Some(ref tx) = self.tx else {
            return false;
        };

        if !self.is_connected() {
            return false;
        }

        tx.send(Message::Text(text.into())).await.is_ok()
    }

    pub fn disconnect(&mut self) {
        // Dropping tx will cause the connection manager to exit
        self.tx = None;
        self.connected.store(false, Ordering::SeqCst);
        if let Some(ref metrics) = self.metrics {
            metrics.set_connection_state(self.endpoint.as_str(), false);
        }
    }
}

impl Drop for Connection {
    fn drop(&mut self) {
        self.disconnect();
    }
}

async fn run_connection_manager(
    mut outgoing_rx: mpsc::Receiver<Message>,
    incoming_tx: mpsc::Sender<IncomingMessage>,
    endpoint: Url,
    config: ConnectionConfig,
    connected: Arc<AtomicBool>,
    metrics: Option<DeliveryMetrics>,
    runtime: AppRuntime,
) {
    let endpoint_str = endpoint.to_string();
    let mut ws_stream: Option<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    > = None;
    let mut reconnect_delay = config.reconnect_delay_initial;
    let mut is_first_attempt = true;

    loop {
        // Check for shutdown
        if runtime.is_shutdown() {
            info!(endpoint = %endpoint_str, "shutdown triggered, closing connection");
            break;
        }

        // Get current WebSocket stream (either initial or from reconnection)
        let current_ws = match ws_stream.take() {
            Some(ws) => {
                // Reset backoff on successful connection
                reconnect_delay = config.reconnect_delay_initial;
                ws
            }
            None => {
                // Need to connect/reconnect
                if !is_first_attempt && !config.auto_reconnect {
                    info!(endpoint = %endpoint_str, "auto-reconnect disabled, exiting");
                    break;
                }

                // No delay on first attempt, backoff delay on reconnects
                if !is_first_attempt {
                    debug!(endpoint = %endpoint_str, delay_ms = reconnect_delay.as_millis(), "attempting reconnection");
                    if let Some(ref m) = metrics {
                        m.record_reconnect_attempt();
                    }
                    // Wait for delay or shutdown
                    tokio::select! {
                        _ = tokio::time::sleep(reconnect_delay) => {}
                        _ = runtime.cancelled() => {
                            info!(endpoint = %endpoint_str, "shutdown during reconnect delay");
                            break;
                        }
                    }
                }
                is_first_attempt = false;

                match connect_async(endpoint.as_str()).await {
                    Ok((ws, _)) => {
                        info!(endpoint = %endpoint_str, "connected");
                        connected.store(true, Ordering::SeqCst);
                        if let Some(ref m) = metrics {
                            m.set_connection_state(&endpoint_str, true);
                        }
                        // Reset backoff on success
                        reconnect_delay = config.reconnect_delay_initial;
                        ws
                    }
                    Err(e) => {
                        debug!(endpoint = %endpoint_str, ?e, "connection failed");
                        // Exponential backoff: double delay, cap at max
                        reconnect_delay = (reconnect_delay * 2).min(config.reconnect_delay_max);
                        continue;
                    }
                }
            }
        };

        let (mut write, mut read) = current_ws.split();

        // Shared ping state for this connection session
        let ping_state = Arc::new(PingState::new());

        // Run the main loop - handles both sending and receiving
        let disconnect_reason = run_session_loop(
            &mut write,
            &mut read,
            &mut outgoing_rx,
            &incoming_tx,
            &endpoint,
            &endpoint_str,
            &ping_state,
            &metrics,
            &config,
            &connected,
            &runtime,
        )
        .await;

        // Mark as disconnected
        connected.store(false, Ordering::SeqCst);
        if let Some(ref m) = metrics {
            m.set_connection_state(&endpoint_str, false);
        }

        // Don't log shutdown as unexpected disconnect
        if matches!(disconnect_reason, DisconnectReason::Shutdown) {
            info!(endpoint = %endpoint_str, "connection closed for shutdown");
            break;
        }

        warn!(endpoint = %endpoint_str, reason = %disconnect_reason, "WebSocket disconnected");

        // Check if we should still try to reconnect
        if outgoing_rx.is_closed() {
            debug!(endpoint = %endpoint_str, "connection dropped, exiting manager");
            break;
        }

        // Drain any pending messages that couldn't be sent
        while outgoing_rx.try_recv().is_ok() {}

        // ws_stream is None, so next iteration will attempt reconnection
    }
}

#[allow(
    clippy::too_many_arguments,
    reason = "internal function, grouping args would add complexity"
)]
async fn run_session_loop(
    write: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        Message,
    >,
    read: &mut futures_util::stream::SplitStream<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    >,
    outgoing_rx: &mut mpsc::Receiver<Message>,
    incoming_tx: &mpsc::Sender<IncomingMessage>,
    endpoint_url: &Url,
    endpoint_str: &str,
    ping_state: &Arc<PingState>,
    metrics: &Option<DeliveryMetrics>,
    config: &ConnectionConfig,
    connected: &Arc<AtomicBool>,
    runtime: &AppRuntime,
) -> DisconnectReason {
    let ping_interval = config.ping_interval.unwrap_or(Duration::from_secs(30));
    let ping_timeout = config.ping_timeout;
    let mut ping_ticker = tokio::time::interval(ping_interval);

    loop {
        tokio::select! {
            // Handle shutdown
            _ = runtime.cancelled() => {
                return DisconnectReason::Shutdown;
            }

            // Handle outgoing messages
            Some(msg) = outgoing_rx.recv() => {
                if let Err(e) = write.send(msg).await {
                    error!(?e, "failed to send WebSocket message");
                    return DisconnectReason::SendError;
                }
            }

            // Handle incoming messages
            result = read.next() => {
                match result {
                    Some(Ok(Message::Pong(_))) => {
                        if let Some(latency) = ping_state.get_ping_latency() {
                            trace!(endpoint = %endpoint_str, latency_ms = latency.as_millis(), "pong received");
                            if let Some(m) = metrics {
                                m.record_ping_latency(latency.as_secs_f64());
                            }
                        }
                    }
                    Some(Ok(Message::Ping(_))) => {
                        trace!("received ping from server");
                    }
                    Some(Ok(Message::Text(text))) => {
                        let msg = IncomingMessage {
                            endpoint: endpoint_url.clone(),
                            text: text.to_string(),
                        };
                        if incoming_tx.send(msg).await.is_err() {
                            return DisconnectReason::IncomingChannelClosed;
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        return DisconnectReason::ReceivedCloseFrame;
                    }
                    Some(Ok(_)) => {
                        // Binary or other message types - ignore
                    }
                    Some(Err(e)) => {
                        error!(endpoint = %endpoint_str, ?e, "WebSocket read error");
                        return DisconnectReason::ReadError;
                    }
                    None => {
                        return DisconnectReason::ConnectionClosed;
                    }
                }
            }

            // Handle heartbeat
            _ = ping_ticker.tick() => {
                // Check if still connected
                if !connected.load(Ordering::SeqCst) {
                    return DisconnectReason::MarkedDisconnected;
                }

                // Check if previous ping got a response
                let pending_nanos = ping_state.last_ping_nanos.load(Ordering::SeqCst);
                if pending_nanos != 0 {
                    #[allow(
                        clippy::cast_possible_truncation,
                        reason = "u64 nanos can represent ~584 years"
                    )]
                    let elapsed = Duration::from_nanos(
                        (ping_state.epoch.elapsed().as_nanos() as u64).saturating_sub(pending_nanos),
                    );
                    if elapsed > ping_timeout {
                        warn!(
                            endpoint = %endpoint_str,
                            elapsed_ms = elapsed.as_millis(),
                            "ping timeout - no pong received"
                        );
                        if let Some(m) = metrics {
                            m.record_ping_timeout();
                        }
                        return DisconnectReason::PingTimeout;
                    }
                }

                // Send new ping
                ping_state.record_ping_sent();
                if let Err(e) = write.send(Message::Ping(vec![].into())).await {
                    error!(?e, "failed to send ping");
                    return DisconnectReason::PingSendError;
                }
                trace!(endpoint = %endpoint_str, "ping sent");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ping_state_record_and_get_latency() {
        let state = PingState::new();
        std::thread::sleep(Duration::from_millis(1));

        state.record_ping_sent();
        assert!(state.last_ping_nanos.load(Ordering::SeqCst) > 0);

        std::thread::sleep(Duration::from_millis(1));

        let latency = state.get_ping_latency();
        assert!(latency.is_some());
        assert!(latency.unwrap() >= Duration::from_micros(500));
        assert_eq!(state.last_ping_nanos.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn test_ping_state_get_latency_without_ping() {
        let state = PingState::new();
        assert!(state.get_ping_latency().is_none());
    }
}
