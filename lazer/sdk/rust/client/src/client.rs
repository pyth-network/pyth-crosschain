use std::time::Duration;

use crate::{
    backoff::{PythLazerExponentialBackoff, PythLazerExponentialBackoffBuilder},
    resilient_ws_connection::PythLazerResilientWSConnection,
    ws_connection::AnyResponse,
    CHANNEL_CAPACITY,
};
use anyhow::{bail, Result};
use backoff::ExponentialBackoff;
use pyth_lazer_protocol::subscription::{SubscribeRequest, SubscriptionId};
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

pub struct PythLazerClient {
    endpoints: Vec<Url>,
    access_token: String,
    num_connections: usize,
    ws_connections: Vec<PythLazerResilientWSConnection>,
    backoff: ExponentialBackoff,
    timeout: Duration,
    channel_capacity: usize,
}

impl PythLazerClient {
    /// Creates a new client instance
    ///
    /// # Arguments
    /// * `endpoints` - A vector of endpoint URLs
    /// * `access_token` - The access token for authentication
    /// * `num_connections` - The number of WebSocket connections to maintain
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

    pub async fn subscribe(&mut self, subscribe_request: SubscribeRequest) -> Result<()> {
        for connection in &mut self.ws_connections {
            connection.subscribe(subscribe_request.clone()).await?;
        }
        Ok(())
    }

    pub async fn unsubscribe(&mut self, subscription_id: SubscriptionId) -> Result<()> {
        for connection in &mut self.ws_connections {
            connection.unsubscribe(subscription_id).await?;
        }
        Ok(())
    }
}

pub struct PythLazerClientBuilder {
    endpoints: Vec<Url>,
    access_token: String,
    num_connections: usize,
    backoff: PythLazerExponentialBackoff,
    timeout: Duration,
    channel_capacity: usize,
}

impl PythLazerClientBuilder {
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

    pub fn with_endpoints(mut self, endpoints: Vec<Url>) -> Self {
        self.endpoints = endpoints;
        self
    }

    pub fn with_num_connections(mut self, num_connections: usize) -> Self {
        self.num_connections = num_connections;
        self
    }

    pub fn with_backoff(mut self, backoff: PythLazerExponentialBackoff) -> Self {
        self.backoff = backoff;
        self
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    pub fn with_channel_capacity(mut self, channel_capacity: usize) -> Self {
        self.channel_capacity = channel_capacity;
        self
    }

    pub fn build(self) -> Result<PythLazerClient> {
        PythLazerClient::new(
            self.endpoints,
            self.access_token,
            self.num_connections,
            self.backoff,
            self.timeout,
            self.channel_capacity,
        )
    }
}
