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
    #[error("shutdown requested")]
    Shutdown,
}

#[derive(Debug, Clone)]
pub struct ConnectionConfig {
    pub send_buffer_size: usize,
    pub recv_buffer_size: usize,
    pub ping_interval: Option<Duration>,
    pub ping_timeout: Duration,
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
        self.last_ping_nanos.store(nanos, Ordering::Relaxed);
    }

    #[allow(
        clippy::cast_possible_truncation,
        reason = "u64 nanos can represent ~584 years, connection won't last that long"
    )]
    fn get_ping_latency(&self) -> Option<Duration> {
        let sent_nanos = self.last_ping_nanos.swap(0, Ordering::Relaxed);
        if sent_nanos == 0 {
            return None;
        }
        let now_nanos = self.epoch.elapsed().as_nanos() as u64;
        Some(Duration::from_nanos(now_nanos.saturating_sub(sent_nanos)))
    }

    fn pending_nanos(&self) -> u64 {
        self.last_ping_nanos.load(Ordering::Relaxed)
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

    pub fn set_metrics(&mut self, metrics: DeliveryMetrics) {
        self.metrics = Some(metrics);
    }

    pub fn endpoint(&self) -> &Url {
        &self.endpoint
    }

    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Acquire)
    }

    /// Start connection manager. Spawns background task with auto-reconnect.
    pub fn start(&mut self, incoming_tx: mpsc::Sender<IncomingMessage>, runtime: AppRuntime) {
        info!(endpoint = %self.endpoint, "starting connection manager");

        let (tx_send, tx_recv) = mpsc::channel::<Message>(self.config.send_buffer_size);

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
        self.tx = None;
        self.connected.store(false, Ordering::Release);
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

type WsStream =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

struct SessionContext<'a> {
    endpoint: &'a Url,
    ping_state: &'a PingState,
    metrics: &'a Option<DeliveryMetrics>,
    config: &'a ConnectionConfig,
    connected: &'a Arc<AtomicBool>,
    runtime: &'a AppRuntime,
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
    let mut reconnect_delay = config.reconnect_delay_initial;
    let mut is_first_attempt = true;

    loop {
        if runtime.is_shutdown() {
            info!(endpoint = %endpoint_str, "shutdown triggered, closing connection");
            break;
        }

        // Connect (with backoff on reconnects)
        if !is_first_attempt {
            debug!(endpoint = %endpoint_str, delay_ms = reconnect_delay.as_millis(), "attempting reconnection");
            if let Some(ref m) = metrics {
                m.record_reconnect_attempt();
            }
            tokio::select! {
                _ = tokio::time::sleep(reconnect_delay) => {}
                _ = runtime.cancelled() => {
                    info!(endpoint = %endpoint_str, "shutdown during reconnect delay");
                    break;
                }
            }
        }
        is_first_attempt = false;

        let ws = match connect_async(endpoint.as_str()).await {
            Ok((ws, _)) => {
                info!(endpoint = %endpoint_str, "connected");
                connected.store(true, Ordering::Release);
                if let Some(ref m) = metrics {
                    m.set_connection_state(&endpoint_str, true);
                }
                reconnect_delay = config.reconnect_delay_initial;
                ws
            }
            Err(e) => {
                debug!(endpoint = %endpoint_str, ?e, "connection failed");
                reconnect_delay = (reconnect_delay * 2).min(config.reconnect_delay_max);
                continue;
            }
        };

        let (mut write, mut read) = ws.split();
        let ping_state = PingState::new();

        let ctx = SessionContext {
            endpoint: &endpoint,
            ping_state: &ping_state,
            metrics: &metrics,
            config: &config,
            connected: &connected,
            runtime: &runtime,
        };
        let disconnect_reason =
            run_session_loop(&mut write, &mut read, &mut outgoing_rx, &incoming_tx, &ctx).await;

        connected.store(false, Ordering::Release);
        if let Some(ref m) = metrics {
            m.set_connection_state(&endpoint_str, false);
        }

        if matches!(disconnect_reason, DisconnectReason::Shutdown) {
            info!(endpoint = %endpoint_str, "connection closed for shutdown");
            break;
        }

        warn!(endpoint = %endpoint_str, reason = %disconnect_reason, "WebSocket disconnected");

        if outgoing_rx.is_closed() {
            debug!(endpoint = %endpoint_str, "connection dropped, exiting manager");
            break;
        }

        while outgoing_rx.try_recv().is_ok() {}
    }
}

async fn run_session_loop(
    write: &mut futures_util::stream::SplitSink<WsStream, Message>,
    read: &mut futures_util::stream::SplitStream<WsStream>,
    outgoing_rx: &mut mpsc::Receiver<Message>,
    incoming_tx: &mpsc::Sender<IncomingMessage>,
    ctx: &SessionContext<'_>,
) -> DisconnectReason {
    let ping_interval = ctx.config.ping_interval.unwrap_or(Duration::from_secs(30));
    let mut ping_ticker = tokio::time::interval(ping_interval);
    let endpoint_str = ctx.endpoint.as_str();

    loop {
        tokio::select! {
            _ = ctx.runtime.cancelled() => {
                return DisconnectReason::Shutdown;
            }

            Some(msg) = outgoing_rx.recv() => {
                if let Err(e) = write.send(msg).await {
                    error!(?e, "failed to send WebSocket message");
                    return DisconnectReason::SendError;
                }
            }

            result = read.next() => {
                match result {
                    Some(Ok(Message::Pong(_))) => {
                        if let Some(latency) = ctx.ping_state.get_ping_latency() {
                            trace!(endpoint = %endpoint_str, latency_ms = latency.as_millis(), "pong received");
                            if let Some(m) = ctx.metrics {
                                m.record_ping_latency(latency.as_secs_f64());
                            }
                        }
                    }
                    Some(Ok(Message::Ping(_))) => {
                        trace!("received ping from server");
                    }
                    Some(Ok(Message::Text(text))) => {
                        let msg = IncomingMessage {
                            endpoint: ctx.endpoint.clone(),
                            text: text.to_string(),
                        };
                        if incoming_tx.send(msg).await.is_err() {
                            return DisconnectReason::IncomingChannelClosed;
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        return DisconnectReason::ReceivedCloseFrame;
                    }
                    Some(Ok(_)) => {}
                    Some(Err(e)) => {
                        error!(endpoint = %endpoint_str, ?e, "WebSocket read error");
                        return DisconnectReason::ReadError;
                    }
                    None => {
                        return DisconnectReason::ConnectionClosed;
                    }
                }
            }

            _ = ping_ticker.tick() => {
                if !ctx.connected.load(Ordering::Acquire) {
                    return DisconnectReason::MarkedDisconnected;
                }

                let pending_nanos = ctx.ping_state.pending_nanos();
                if pending_nanos != 0 {
                    #[allow(clippy::cast_possible_truncation, reason = "u64 nanos can represent ~584 years")]
                    let elapsed = Duration::from_nanos(
                        (ctx.ping_state.epoch.elapsed().as_nanos() as u64).saturating_sub(pending_nanos),
                    );
                    if elapsed > ctx.config.ping_timeout {
                        warn!(endpoint = %endpoint_str, elapsed_ms = elapsed.as_millis(), "ping timeout");
                        if let Some(m) = ctx.metrics {
                            m.record_ping_timeout();
                        }
                        return DisconnectReason::PingTimeout;
                    }
                }

                ctx.ping_state.record_ping_sent();
                if let Err(e) = write.send(Message::Ping(vec![].into())).await {
                    error!(?e, "failed to send ping");
                    return DisconnectReason::SendError;
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
        assert!(state.pending_nanos() > 0);

        std::thread::sleep(Duration::from_millis(1));

        let latency = state.get_ping_latency();
        assert!(latency.is_some());
        assert!(latency.unwrap() >= Duration::from_micros(500));
        assert_eq!(state.pending_nanos(), 0);
    }

    #[test]
    fn test_ping_state_get_latency_without_ping() {
        let state = PingState::new();
        assert!(state.get_ping_latency().is_none());
    }
}
