//! # Hermes Client
//!
//! This module provides a high-level client for connecting to Hermes data streams.
//! The client maintains multiple WebSocket connections for redundancy and provides
//! automatic deduplication of messages.
//!
//! ## Features
//!
//! - Multiple redundant WebSocket connections
//! - Automatic message deduplication
//! - Exponential backoff for reconnections
//! - Configurable timeouts and channel capacities
//! - Builder pattern for easy configuration
//!
//! ## Basic Usage
//!
//! ```rust,ignore
//! use hermes_client::{HermesClientBuilder, HermesClientMessageSubscribe};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let mut client = HermesClientBuilder::default()
//!         .with_num_connections(2)
//!         .build()?;
//!
//!     let mut receiver = client.start().await?;
//!
//!     // Subscribe to price feeds
//!     let subscribe_request = HermesClientMessageSubscribe {
//!         // ... configure subscription
//!     };
//!     client.subscribe(subscribe_request).await?;
//!
//!     // Process incoming messages
//!     while let Some(response) = receiver.recv().await {
//!         println!("Received: {:?}", response);
//!     }
//!
//!     Ok(())
//! }
//! ```

use std::time::Duration;

use crate::{
    backoff::{HermesExponentialBackoff, HermesExponentialBackoffBuilder},
    resilient_ws_connection::HermesResilientWSConnection,
    ws_connection::{
        HermesClientMessage, HermesClientMessageSubscribe, HermesClientMessageUnsubscribe,
        HermesServerMessage,
    },
    CHANNEL_CAPACITY,
};
use anyhow::{bail, Result};
use backoff::ExponentialBackoff;
use tokio::sync::mpsc::{self, error::TrySendError};
use tracing::{error, warn};
use ttl_cache::TtlCache;
use url::Url;

const DEDUP_CACHE_SIZE: usize = 100_000;
const DEDUP_TTL: Duration = Duration::from_secs(10);

const DEFAULT_ENDPOINTS: [&str; 1] = ["wss://hermes.pyth.network/ws"];
const DEFAULT_NUM_CONNECTIONS: usize = 3;
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(5);

/// A high-performance client for connecting to Hermes data streams.
///
/// The `HermesClient` maintains multiple WebSocket connections to Hermes endpoints
/// for redundancy. It automatically handles connection management,
/// message deduplication, and provides a unified stream of price updates.
///
/// ## Architecture
///
/// - Maintains multiple WebSocket connections to different endpoints
/// - Uses a TTL cache for deduplicating messages across connections
/// - Provides a single channel for consuming deduplicated messages
/// - Handles connection failures with exponential backoff
pub struct HermesClient {
    endpoints: Vec<Url>,
    num_connections: usize,
    ws_connections: Vec<HermesResilientWSConnection>,
    backoff: ExponentialBackoff,
    timeout: Duration,
    channel_capacity: usize,
}

impl HermesClient {
    /// Creates a new Hermes client instance.
    ///
    /// This is a low-level constructor. Consider using [`HermesClientBuilder`] for a more
    /// convenient way to create clients with sensible defaults.
    ///
    /// # Arguments
    ///
    /// * `endpoints` - A vector of WebSocket endpoint URLs to connect to. Must not be empty.
    /// * `num_connections` - The number of WebSocket connections to maintain for redundancy
    /// * `backoff` - The exponential backoff configuration for connection retries
    /// * `timeout` - The timeout duration for WebSocket operations
    /// * `channel_capacity` - The capacity of the message channel
    ///
    /// # Returns
    ///
    /// Returns `Ok(HermesClient)` on success, or an error if the configuration is invalid.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The `endpoints` vector is empty
    ///
    pub fn new(
        endpoints: Vec<Url>,
        num_connections: usize,
        backoff: HermesExponentialBackoff,
        timeout: Duration,
        channel_capacity: usize,
    ) -> Result<Self> {
        if endpoints.is_empty() {
            bail!("At least one endpoint must be provided");
        }
        Ok(Self {
            endpoints,
            num_connections,
            ws_connections: Vec::with_capacity(num_connections),
            backoff: backoff.into(),
            timeout,
            channel_capacity,
        })
    }

    /// Starts the client and begins establishing WebSocket connections.
    ///
    /// This method initializes all WebSocket connections and starts the message processing
    /// loop. It returns a receiver channel that will yield deduplicated messages from
    /// all connections.
    ///
    /// # Returns
    ///
    /// Returns a `Receiver<HermesServerMessage>` that yields deduplicated messages from all
    /// WebSocket connections. The receiver will continue to yield messages until
    /// all connections are closed or the client is dropped.
    ///
    /// # Errors
    ///
    /// This method itself doesn't return errors, but individual connection failures
    /// are handled internally with automatic reconnection using the configured backoff
    /// strategy.
    ///
    /// # Message Deduplication
    ///
    /// Messages are deduplicated using a TTL cache with a 10-second window. This ensures
    /// that identical messages received from multiple connections are only delivered once.
    ///
    pub async fn start(&mut self) -> Result<mpsc::Receiver<HermesServerMessage>> {
        let (sender, receiver) = mpsc::channel::<HermesServerMessage>(self.channel_capacity);
        let (ws_connection_sender, mut ws_connection_receiver) =
            mpsc::channel::<HermesServerMessage>(CHANNEL_CAPACITY);

        for i in 0..self.num_connections {
            let endpoint = self.endpoints[i % self.endpoints.len()].clone();
            let connection = HermesResilientWSConnection::new(
                endpoint,
                self.backoff.clone(),
                self.timeout,
                ws_connection_sender.clone(),
            );
            self.ws_connections.push(connection);
        }

        let mut seen_updates = TtlCache::new(DEDUP_CACHE_SIZE);

        tokio::spawn(async move {
            while let Some(response) = ws_connection_receiver.recv().await {
                let cache_key = response.cache_key();
                if seen_updates.contains_key(&cache_key) {
                    continue;
                }
                seen_updates.insert(cache_key, response.clone(), DEDUP_TTL);

                match sender.try_send(response) {
                    Ok(_) => (),
                    Err(TrySendError::Full(r)) => {
                        warn!("Sender channel is full, responses will be delayed");
                        if sender.send(r).await.is_err() {
                            error!("Sender channel is closed, stopping client");
                        }
                    }
                    Err(TrySendError::Closed(_)) => {
                        error!("Sender channel is closed, stopping client");
                    }
                }
            }
        });

        Ok(receiver)
    }

    /// Subscribes to data streams across all WebSocket connections.
    ///
    /// This method sends the subscription request to all active WebSocket connections,
    /// ensuring redundancy. If any connection fails to subscribe,
    /// an error is returned, but other connections may still be subscribed.
    ///
    /// # Arguments
    ///
    /// * `subscribe_request` - The subscription request specifying which data streams to subscribe to
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` if the subscription was successfully sent to all connections,
    /// or an error if any connection failed to process the subscription.
    ///
    pub async fn subscribe(
        &mut self,
        subscribe_request: HermesClientMessageSubscribe,
    ) -> Result<()> {
        for connection in &mut self.ws_connections {
            connection
                .send_request(HermesClientMessage::Subscribe(subscribe_request.clone()))
                .await?;
        }
        Ok(())
    }

    /// Unsubscribes from a specific data stream across all WebSocket connections.
    ///
    /// This method sends an unsubscribe request for the specified subscription ID
    /// to all active WebSocket connections.
    ///
    /// # Arguments
    ///
    /// * `unsubscribe_request` - The unsubscribe request specifying which data streams to unsubscribe from
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` if the unsubscribe request was successfully sent to all connections,
    /// or an error if any connection failed to process the request.
    ///
    pub async fn unsubscribe(
        &mut self,
        unsubscribe_request: HermesClientMessageUnsubscribe,
    ) -> Result<()> {
        for connection in &mut self.ws_connections {
            connection
                .send_request(HermesClientMessage::Unsubscribe(
                    unsubscribe_request.clone(),
                ))
                .await?;
        }
        Ok(())
    }
}

/// A builder for creating [`HermesClient`] instances with customizable configuration.
///
/// The builder provides a convenient way to configure a Hermes client with sensible
/// defaults while allowing customization of all parameters. It follows the builder pattern
/// for a fluent API.
///
/// ## Default Configuration
///
/// - **Endpoints**: Uses Hermes's default production endpoints
/// - **Connections**: 3 concurrent WebSocket connections
/// - **Timeout**: 5 seconds for WebSocket operations
/// - **Backoff**: Exponential backoff with default settings
/// - **Channel Capacity**: Uses the default 1000
///
pub struct HermesClientBuilder {
    endpoints: Vec<Url>,
    num_connections: usize,
    backoff: HermesExponentialBackoff,
    timeout: Duration,
    channel_capacity: usize,
}

impl Default for HermesClientBuilder {
    fn default() -> Self {
        Self {
            endpoints: DEFAULT_ENDPOINTS
                .iter()
                .map(|&s| s.parse().unwrap())
                .collect(),
            num_connections: DEFAULT_NUM_CONNECTIONS,
            backoff: HermesExponentialBackoffBuilder::default().build(),
            timeout: DEFAULT_TIMEOUT,
            channel_capacity: CHANNEL_CAPACITY,
        }
    }
}

impl HermesClientBuilder {
    /// Sets custom WebSocket endpoints for the client.
    ///
    /// By default, the client uses Hermes's production endpoints. Use this method
    /// to connect to different environments (staging, local development) or to use
    /// custom endpoint configurations.
    ///
    /// # Arguments
    ///
    /// * `endpoints` - A vector of WebSocket endpoint URLs. Must not be empty.
    ///
    pub fn with_endpoints(mut self, endpoints: Vec<Url>) -> Self {
        self.endpoints = endpoints;
        self
    }

    /// Sets the number of concurrent WebSocket connections to maintain.
    ///
    /// More connections provide better redundancy and can improve throughput,
    /// but also consume more resources.
    ///
    /// # Arguments
    ///
    /// * `num_connections` - The number of WebSocket connections (must be > 0)
    ///
    pub fn with_num_connections(mut self, num_connections: usize) -> Self {
        self.num_connections = num_connections;
        self
    }

    /// Sets the exponential backoff configuration for connection retries.
    ///
    /// The backoff strategy determines how the client handles connection failures
    /// and retries.
    ///
    /// # Arguments
    ///
    /// * `backoff` - The exponential backoff configuration
    ///
    pub fn with_backoff(mut self, backoff: HermesExponentialBackoff) -> Self {
        self.backoff = backoff;
        self
    }

    /// Sets the timeout duration for WebSocket operations.
    ///
    /// This timeout applies to each WebSocket connection,
    /// if no response is received within this duration,
    /// the connection will be considered failed and retried.
    ///
    /// # Arguments
    ///
    /// * `timeout` - The timeout duration for each WebSocket
    ///
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Sets the capacity of the internal message channel.
    ///
    /// This determines how many messages can be buffered internally before
    /// the client starts applying backpressure.
    ///
    /// # Arguments
    ///
    /// * `channel_capacity` - The channel capacity (number of messages)
    ///
    pub fn with_channel_capacity(mut self, channel_capacity: usize) -> Self {
        self.channel_capacity = channel_capacity;
        self
    }

    /// Builds the configured [`HermesClient`] instance.
    ///
    /// This consumes the builder and creates a new client with the specified
    /// configuration. The client is ready to use but connections are not
    /// established until [`HermesClient::start`] is called.
    ///
    /// # Returns
    ///
    /// Returns `Ok(HermesClient)` on success, or an error if the configuration
    /// is invalid.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - No endpoints are configured
    /// - Any configuration parameter is invalid
    ///
    pub fn build(self) -> Result<HermesClient> {
        HermesClient::new(
            self.endpoints,
            self.num_connections,
            self.backoff,
            self.timeout,
            self.channel_capacity,
        )
    }
}
