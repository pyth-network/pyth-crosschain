//! Multi-endpoint WebSocket client.

use crate::connection::{Connection, ConnectionConfig, IncomingMessage};
use crate::metrics::DeliveryMetrics;
use pusher_utils::AppRuntime;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use url::Url;

/// Delivers messages to multiple WebSocket endpoints with auto-reconnect.
pub struct WebsocketDeliveryClient {
    connections: Vec<Arc<Mutex<Connection>>>,
    metrics: Option<DeliveryMetrics>,
    config: ConnectionConfig,
    incoming_rx: Option<mpsc::Receiver<IncomingMessage>>,
    incoming_tx: mpsc::Sender<IncomingMessage>,
}

impl WebsocketDeliveryClient {
    pub fn new(endpoints: Vec<Url>) -> Self {
        Self::with_config(endpoints, ConnectionConfig::default())
    }

    pub fn with_config(endpoints: Vec<Url>, config: ConnectionConfig) -> Self {
        let connections = endpoints
            .into_iter()
            .map(|url| Arc::new(Mutex::new(Connection::with_config(url, config.clone()))))
            .collect();

        // Create channel for incoming messages (larger buffer for multi-endpoint)
        let (incoming_tx, incoming_rx) = mpsc::channel(config.recv_buffer_size * 10);

        Self {
            connections,
            metrics: None,
            config,
            incoming_rx: Some(incoming_rx),
            incoming_tx,
        }
    }

    #[allow(
        clippy::expect_used,
        reason = "with_metrics is called before connect_all, so locks are uncontested"
    )]
    pub fn with_metrics(mut self, metrics: DeliveryMetrics) -> Self {
        self.metrics = Some(metrics.clone());
        self.connections = self
            .connections
            .iter()
            .map(|c| {
                // try_lock is safe here - called before connect_all, no contention possible
                let conn = c.try_lock().expect("connection not yet shared");
                let endpoint = conn.endpoint().clone();
                drop(conn);
                Arc::new(Mutex::new(
                    Connection::with_config(endpoint, self.config.clone())
                        .with_metrics(metrics.clone()),
                ))
            })
            .collect();
        self
    }

    pub fn start_all(&mut self, runtime: AppRuntime) {
        for conn_arc in &self.connections {
            // Use try_lock since we're the only ones accessing during startup
            if let Ok(mut conn) = conn_arc.try_lock() {
                conn.start(self.incoming_tx.clone(), runtime.clone());
            }
        }
    }

    pub fn take_incoming_receiver(&mut self) -> Option<mpsc::Receiver<IncomingMessage>> {
        self.incoming_rx.take()
    }

    pub async fn send_all<B>(&self, build_message: B) -> usize
    where
        B: Fn(&Url) -> String,
    {
        let mut sent_count = 0;

        for conn_arc in &self.connections {
            let conn = conn_arc.lock().await;
            if conn.is_connected() {
                let msg = build_message(conn.endpoint());
                if conn.send(msg).await {
                    sent_count += 1;
                }
            }
        }

        sent_count
    }

    pub async fn send_all_same(&self, message: &str) -> usize {
        let msg = message.to_string();
        self.send_all(|_| msg.clone()).await
    }

    pub async fn connected_count(&self) -> usize {
        let mut count = 0;
        for conn_arc in &self.connections {
            if conn_arc.lock().await.is_connected() {
                count += 1;
            }
        }
        count
    }

    pub fn connected_count_sync(&self) -> usize {
        self.connections
            .iter()
            .filter(|c| c.try_lock().is_ok_and(|c| c.is_connected()))
            .count()
    }

    pub fn endpoint_count(&self) -> usize {
        self.connections.len()
    }

    pub async fn endpoints(&self) -> Vec<Url> {
        let mut urls = Vec::with_capacity(self.connections.len());
        for conn_arc in &self.connections {
            urls.push(conn_arc.lock().await.endpoint().clone());
        }
        urls
    }

    pub async fn is_endpoint_connected(&self, endpoint: &Url) -> bool {
        for conn_arc in &self.connections {
            let conn = conn_arc.lock().await;
            if conn.endpoint() == endpoint {
                return conn.is_connected();
            }
        }
        false
    }
}
