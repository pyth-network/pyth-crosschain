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

        let (incoming_tx, incoming_rx) = mpsc::channel(config.recv_buffer_size * 10);

        Self {
            connections,
            incoming_rx: Some(incoming_rx),
            incoming_tx,
        }
    }

    /// Set metrics on all connections. Must be called before start_all.
    pub fn with_metrics(self, metrics: DeliveryMetrics) -> Self {
        for conn_arc in &self.connections {
            if let Ok(mut conn) = conn_arc.try_lock() {
                conn.set_metrics(metrics.clone());
            }
        }
        self
    }

    pub fn start_all(&mut self, runtime: AppRuntime) {
        for conn_arc in &self.connections {
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
        self.send_all(|_| message.to_string()).await
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
