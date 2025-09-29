//! # Pyth Lazer Client
//!
//! This module provides a high-level client for connecting to Pyth Lazer data streams.
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
//! use pyth_lazer_client::PythLazerStreamClientBuilder;
//! use pyth_lazer_protocol::subscription::SubscribeRequest;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let mut client = PythLazerStreamClientBuilder::new("your_access_token".to_string())
//!         .with_num_connections(2)
//!         .build()?;
//!
//!     let mut receiver = client.start().await?;
//!
//!     // Subscribe to price feeds
//!     let subscribe_request = SubscribeRequest {
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
    backoff::{PythLazerExponentialBackoff, PythLazerExponentialBackoffBuilder},
    resilient_ws_connection::PythLazerResilientWSConnection,
    ws_connection::AnyResponse,
    CHANNEL_CAPACITY,
};
use anyhow::{bail, Result};
use backoff::ExponentialBackoff;
use pyth_lazer_protocol::api::{SubscribeRequest, SubscriptionId};
use tokio::sync::mpsc::{self, error::TrySendError};
use tracing::{error, warn};
use ttl_cache::TtlCache;
use url::Url;

const DEDUP_CACHE_SIZE: usize = 100_000;
const DEDUP_TTL: Duration = Duration::from_secs(10);

const DEFAULT_ENDPOINTS: [&str; 2] = [
    "wss://pyth-lazer-0.dourolabs.app/v1/stream",
    "wss://pyth-lazer-1.dourolabs.app/v1/stream",
];
const DEFAULT_NUM_CONNECTIONS: usize = 4;
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(5);

/// A high-performance client for connecting to Pyth Lazer data streams.
///
/// The `PythLazerStreamClient` maintains multiple WebSocket connections to Pyth Lazer endpoints
/// for redundancy. It automatically handles connection management,
/// message deduplication, and provides a unified stream of price updates.
///
/// ## Architecture
///
/// - Maintains multiple WebSocket connections to different endpoints
/// - Uses a TTL cache for deduplicating messages across connections
/// - Provides a single channel for consuming deduplicated messages
/// - Handles connection failures with exponential backoff
pub struct PythLazerStreamClient {
    endpoints: Vec<Url>,
    access_token: String,
    num_connections: usize,
    ws_connections: Vec<PythLazerResilientWSConnection>,
    backoff: ExponentialBackoff,
    timeout: Duration,
    channel_capacity: usize,
}

impl PythLazerStreamClient {
    /// Creates a new Pyth Lazer client instance.
    ///
    /// This is a low-level constructor. Consider using [`PythLazerStreamClientBuilder`] for a more
    /// convenient way to create clients with sensible defaults.
    ///
    /// # Arguments
    ///
    /// * `endpoints` - A vector of WebSocket endpoint URLs to connect to. Must not be empty.
    /// * `access_token` - The authentication token for accessing Pyth Lazer services
    /// * `num_connections` - The number of WebSocket connections to maintain for redundancy
    /// * `backoff` - The exponential backoff configuration for connection retries
    /// * `timeout` - The timeout duration for WebSocket operations
    /// * `channel_capacity` - The capacity of the message channel
    ///
    /// # Returns
    ///
    /// Returns `Ok(PythLazerStreamClient)` on success, or an error if the configuration is invalid.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The `endpoints` vector is empty
    ///
    pub fn new(
        endpoints: Vec<Url>,
        access_token: String,
        num_connections: usize,
        backoff: PythLazerExponentialBackoff,
        timeout: Duration,
        channel_capacity: usize,
    ) -> Result<Self> {
        if endpoints.is_empty() {
            bail!("At least one endpoint must be provided");
        }
        Ok(Self {
            endpoints,
            access_token,
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
    /// Returns a `Receiver<AnyResponse>` that yields deduplicated messages from all
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
    pub async fn start(&mut self) -> Result<mpsc::Receiver<AnyResponse>> {
        let (sender, receiver) = mpsc::channel::<AnyResponse>(self.channel_capacity);
        let (ws_connection_sender, mut ws_connection_receiver) =
            mpsc::channel::<AnyResponse>(CHANNEL_CAPACITY);

        for i in 0..self.num_connections {
            let endpoint = self.endpoints[i % self.endpoints.len()].clone();
            let connection = PythLazerResilientWSConnection::new(
                endpoint,
                self.access_token.clone(),
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
                seen_updates.insert(cache_key, true, DEDUP_TTL);

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
    pub async fn subscribe(&mut self, subscribe_request: SubscribeRequest) -> Result<()> {
        for connection in &mut self.ws_connections {
            connection.subscribe(subscribe_request.clone()).await?;
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
    /// * `subscription_id` - The ID of the subscription to cancel
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` if the unsubscribe request was successfully sent to all connections,
    /// or an error if any connection failed to process the request.
    ///
    pub async fn unsubscribe(&mut self, subscription_id: SubscriptionId) -> Result<()> {
        for connection in &mut self.ws_connections {
            connection.unsubscribe(subscription_id).await?;
        }
        Ok(())
    }
}

/// A builder for creating [`PythLazerStreamClient`] instances with customizable configuration.
///
/// The builder provides a convenient way to configure a Pyth Lazer client with sensible
/// defaults while allowing customization of all parameters. It follows the builder pattern
/// for a fluent API.
///
/// ## Default Configuration
///
/// - **Endpoints**: Uses Pyth Lazer's default production endpoints
/// - **Connections**: 4 concurrent WebSocket connections
/// - **Timeout**: 5 seconds for WebSocket operations
/// - **Backoff**: Exponential backoff with default settings
/// - **Channel Capacity**: Uses the default 1000
///
pub struct PythLazerStreamClientBuilder {
    endpoints: Vec<Url>,
    access_token: String,
    num_connections: usize,
    backoff: PythLazerExponentialBackoff,
    timeout: Duration,
    channel_capacity: usize,
}

impl PythLazerStreamClientBuilder {
    /// Creates a new builder with default configuration.
    ///
    /// This initializes the builder with sensible defaults for production use:
    /// - Default Pyth Lazer endpoints
    /// - 4 WebSocket connections
    /// - 5-second timeout
    ///
    /// # Arguments
    ///
    /// * `access_token` - The authentication token for accessing Pyth Lazer services
    ///
    pub fn new(access_token: String) -> Self {
        Self {
            endpoints: DEFAULT_ENDPOINTS
                .iter()
                .map(|&s| s.parse().unwrap())
                .collect(),
            access_token,
            num_connections: DEFAULT_NUM_CONNECTIONS,
            backoff: PythLazerExponentialBackoffBuilder::default().build(),
            timeout: DEFAULT_TIMEOUT,
            channel_capacity: CHANNEL_CAPACITY,
        }
    }

    /// Sets custom WebSocket endpoints for the client.
    ///
    /// By default, the client uses Pyth Lazer's production endpoints. Use this method
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
    pub fn with_backoff(mut self, backoff: PythLazerExponentialBackoff) -> Self {
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

    /// Builds the configured [`PythLazerStreamClient`] instance.
    ///
    /// This consumes the builder and creates a new client with the specified
    /// configuration. The client is ready to use but connections are not
    /// established until [`PythLazerStreamClient::start`] is called.
    ///
    /// # Returns
    ///
    /// Returns `Ok(PythLazerStreamClient)` on success, or an error if the configuration
    /// is invalid.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - No endpoints are configured
    /// - Any configuration parameter is invalid
    ///
    pub fn build(self) -> Result<PythLazerStreamClient> {
        PythLazerStreamClient::new(
            self.endpoints,
            self.access_token,
            self.num_connections,
            self.backoff,
            self.timeout,
            self.channel_capacity,
        )
    }
}
