use {
    anyhow::{anyhow, Result},
    futures_util::{SinkExt, StreamExt},
    pyth_lazer_protocol::{
        router::{
            Chain, Channel, DeliveryFormat, FixedRate, PriceFeedId, PriceFeedProperty,
            SubscriptionParams, SubscriptionParamsRepr,
        },
        subscription::{Request, Response, SubscribeRequest, SubscriptionId, UnsubscribeRequest},
    },
    std::{
        collections::HashMap,
        sync::Arc,
        time::{Duration, Instant},
    },
    tokio::{
        net::TcpStream,
        sync::{broadcast, Mutex},
    },
    tokio_tungstenite::{
        connect_async, tungstenite::protocol::Message, MaybeTlsStream, WebSocketStream,
    },
    tracing::{debug, error, info, warn},
    ttl_cache::TtlCache,
};

const CONNECTION_TIMEOUT: Duration = Duration::from_secs(5);
const DEFAULT_NUM_CONNECTIONS: usize = 3;
const MAX_NUM_CONNECTIONS: usize = 50;
const STREAM_POOL_CHANNEL_SIZE: usize = 100_000;
const TICKER_STREAM_CHANNEL_SIZE: usize = 100_000;
const DEDUP_CACHE_SIZE: usize = 100_000;
const DEDUP_TTL: Duration = Duration::from_secs(10);
const RECONNECT_WAIT: Duration = Duration::from_secs(1);
const RECONNECT_STAGGER: Duration = Duration::from_secs(1);

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;
type WsSink = futures_util::stream::SplitSink<WsStream, Message>;
type WsSource = futures_util::stream::SplitStream<WsStream>;

pub struct ConnectionState {
    pub id: usize,
    pub url: String,
    pub(crate) write: Option<WsSink>,
    pub(crate) last_message: Option<Instant>,
    pub(crate) healthy: bool,
    pub(crate) error_count: usize,
}

impl ConnectionState {
    pub fn new(id: usize, url: String) -> Self {
        Self {
            id,
            url,
            write: None,
            last_message: None,
            healthy: false,
            error_count: 0,
        }
    }

    fn mark_healthy(&mut self) {
        self.healthy = true;
        self.error_count = 0;
        self.last_message = Some(Instant::now());
    }

    fn mark_error(&mut self) {
        self.healthy = false;
        self.error_count += 1;
        self.write = None;
    }
}

impl Clone for ConnectionState {
    fn clone(&self) -> Self {
        Self {
            id: self.id,
            url: self.url.clone(),
            write: None,
            last_message: self.last_message,
            healthy: self.healthy,
            error_count: self.error_count,
        }
    }
}

#[derive(Clone)]
pub struct PythLazerConsumer {
    urls: Vec<String>,
    token: String,
    active_subscriptions: Arc<Mutex<HashMap<u64, SubscribeRequest>>>,
    tx: broadcast::Sender<Response>,
    stream_tx: broadcast::Sender<Response>,
    connections: Arc<Mutex<Vec<Arc<Mutex<ConnectionState>>>>>,
    pub(crate) message_cache: Arc<Mutex<TtlCache<String, ()>>>,
    reconnect_attempts: Arc<Mutex<HashMap<usize, usize>>>,
}

impl PythLazerConsumer {
    pub fn get_tx(&self) -> &broadcast::Sender<Response> {
        &self.tx
    }

    pub async fn process_message(
        &self,
        message: Message,
        cache: &Arc<Mutex<TtlCache<String, ()>>>,
    ) -> Result<()> {
        if let Message::Text(text) = message {
            if let Ok(response) = serde_json::from_str::<Response>(&text) {
                let msg_key = format!("{:?}", &response);
                let mut cache = cache.lock().await;

                if cache.contains_key(&msg_key) {
                    return Ok(());
                }

                cache.insert(msg_key, (), DEDUP_TTL);

                if let Err(e) = self.tx.send(response) {
                    return Err(anyhow!("Failed to forward message: {}", e));
                }
            }
        }
        Ok(())
    }
}

impl PythLazerConsumer {
    pub async fn new(urls: Vec<String>, token: String) -> Result<Self> {
        let (tx, _) = broadcast::channel(TICKER_STREAM_CHANNEL_SIZE);
        let (stream_tx, _) = broadcast::channel(STREAM_POOL_CHANNEL_SIZE);
        let num_connections = urls
            .len()
            .clamp(DEFAULT_NUM_CONNECTIONS, MAX_NUM_CONNECTIONS);

        let mut connections = Vec::with_capacity(num_connections);
        for i in 0..num_connections {
            let url = urls[i % urls.len()].clone();
            let connection = ConnectionState::new(i, url);
            connections.push(Arc::new(Mutex::new(connection)));
        }

        let consumer = Self {
            urls,
            token,
            active_subscriptions: Arc::new(Mutex::new(HashMap::new())),
            tx,
            stream_tx,
            connections: Arc::new(Mutex::new(connections)),
            message_cache: Arc::new(Mutex::new(TtlCache::new(DEDUP_CACHE_SIZE))),
            reconnect_attempts: Arc::new(Mutex::new(HashMap::new())),
        };

        Ok(consumer)
    }

    fn exponential_backoff(attempts: usize) -> Duration {
        use rand::Rng;

        const BASE_DELAY: u64 = 100; // 100ms
        const MAX_DELAY: u64 = 30_000; // 30s

        let base_delay = (2u64.pow(attempts as u32) * BASE_DELAY).min(MAX_DELAY);
        let jitter = rand::thread_rng().gen_range(0..=(base_delay / 10)); // 10% jitter
        Duration::from_millis(base_delay.saturating_add(jitter))
    }

    async fn connect_with_backoff(&self, connection: &mut ConnectionState) -> Result<()> {
        loop {
            let attempt_count = {
                let mut attempts_guard = self.reconnect_attempts.lock().await;
                *attempts_guard.entry(connection.id).or_insert(0)
            };

            match self.connect_single(connection).await {
                Ok(_) => {
                    debug!("Connection {} established successfully", connection.id);
                    let mut attempts_guard = self.reconnect_attempts.lock().await;
                    *attempts_guard.entry(connection.id).or_insert(0) = 0;
                    return Ok(());
                }
                Err(e) => {
                    error!("Connection {} failed: {}", connection.id, e);
                    {
                        let mut attempts_guard = self.reconnect_attempts.lock().await;
                        *attempts_guard.entry(connection.id).or_insert(0) += 1;
                    }

                    let backoff = Self::exponential_backoff(attempt_count + 1);
                    warn!(
                        "Connection {} backing off for {:?} (attempt {})",
                        connection.id,
                        backoff,
                        attempt_count + 1
                    );

                    tokio::time::sleep(backoff).await;

                    // Reset attempts if we've tried too many times
                    if attempt_count >= 10 {
                        let mut attempts_guard = self.reconnect_attempts.lock().await;
                        warn!(
                            "Connection {} resetting attempt counter after {} attempts",
                            connection.id, attempt_count
                        );
                        *attempts_guard.entry(connection.id).or_insert(0) = 0;
                    }
                }
            }
        }
    }

    async fn connect_single(&self, connection: &mut ConnectionState) -> Result<()> {
        debug!(
            "Attempting to connect to {} (connection {})",
            connection.url, connection.id
        );

        let request = http::Request::builder()
            .uri(&connection.url)
            .header("Authorization", format!("Bearer {}", self.token))
            .body(())?;

        let (ws_stream, _) =
            match tokio::time::timeout(CONNECTION_TIMEOUT, connect_async(request)).await {
                Ok(Ok(result)) => result,
                Ok(Err(e)) => {
                    connection.mark_error();
                    return Err(anyhow!("WebSocket connection failed: {}", e));
                }
                Err(_) => {
                    connection.mark_error();
                    return Err(anyhow!(
                        "Connection timed out after {:?}",
                        CONNECTION_TIMEOUT
                    ));
                }
            };

        let (write, read) = ws_stream.split();
        connection.write = Some(write);
        connection.mark_healthy();

        // Set up message handling
        let tx = self.tx.clone();
        let cache = self.message_cache.clone();
        let connection_id = connection.id;
        let message_handler = tokio::spawn(async move {
            if let Err(e) = Self::handle_messages(read, tx, cache).await {
                error!(
                    "Message handler for connection {} failed: {}",
                    connection_id, e
                );
            }
        });

        // Resubscribe to active subscriptions
        if let Some(write) = &mut connection.write {
            let subscriptions = self.active_subscriptions.lock().await;
            for request in subscriptions.values() {
                debug!(
                    "Resubscribing to feed {} on connection {}",
                    request.subscription_id.0, connection.id
                );
                let msg = serde_json::to_string(&Request::Subscribe(request.clone()))?;
                if let Err(e) = write.send(Message::Text(msg)).await {
                    error!(
                        "Failed to resubscribe on connection {}: {}",
                        connection.id, e
                    );
                    connection.mark_error();
                    return Err(e.into());
                }
            }
            debug!(
                "Successfully resubscribed {} feeds on connection {}",
                subscriptions.len(),
                connection.id
            );
        }

        // Wait for the message handler to complete
        match message_handler.await {
            Ok(_) => Ok(()),
            Err(e) => {
                error!("Message handler task panicked: {}", e);
                Err(anyhow!("Message handler task failed"))
            }
        }
    }

    async fn run_connection_loop(&self, mut connection: ConnectionState) {
        loop {
            if let Err(e) = self.connect_with_backoff(&mut connection).await {
                error!("Connection {} failed permanently: {}", connection.id, e);
                tokio::time::sleep(RECONNECT_WAIT).await;
                continue;
            }

            // If we get here, the connection was closed gracefully
            warn!(
                "Connection {} closed, waiting {} seconds before reconnecting...",
                connection.id,
                RECONNECT_WAIT.as_secs()
            );
            tokio::time::sleep(RECONNECT_WAIT).await;
        }
    }

    pub async fn connect(&mut self) -> Result<()> {
        let num_connections = self.urls.len().min(MAX_NUM_CONNECTIONS);
        let mut connections = Vec::with_capacity(num_connections);

        for i in 0..num_connections {
            let url = self.urls[i % self.urls.len()].clone();
            let connection = ConnectionState::new(i, url);
            connections.push(Arc::new(Mutex::new(connection)));
        }

        *self.connections.lock().await = connections.clone();

        for (i, connection) in connections.into_iter().enumerate() {
            let consumer = self.clone();

            // Stagger connection attempts
            if i > 0 {
                tokio::time::sleep(RECONNECT_STAGGER).await;
            }

            tokio::spawn(async move {
                let conn = connection.lock().await.clone();
                consumer.run_connection_loop(conn).await;
            });
        }

        Ok(())
    }

    /// Subscribe to price feed updates.
    ///
    /// # Arguments
    /// * `subscription_id` - Unique identifier for this subscription
    /// * `feed_ids` - List of price feed IDs to subscribe to
    /// * `properties` - Optional list of properties to receive (defaults to [Price])
    /// * `chains` - Optional list of chains to receive updates for (defaults to [EVM, Solana])
    /// * `delivery_format` - Optional message format (defaults to JSON)
    pub async fn subscribe(
        &mut self,
        subscription_id: u64,
        feed_ids: Vec<PriceFeedId>,
        properties: Option<Vec<PriceFeedProperty>>,
        chains: Option<Vec<Chain>>,
        delivery_format: Option<DeliveryFormat>,
    ) -> Result<()> {
        let params = SubscriptionParams::new(SubscriptionParamsRepr {
            price_feed_ids: feed_ids,
            properties: properties.unwrap_or_else(|| vec![PriceFeedProperty::Price]),
            chains: chains.unwrap_or_else(|| vec![Chain::Evm, Chain::Solana]),
            delivery_format: delivery_format.unwrap_or_default(),
            json_binary_encoding: Default::default(),
            parsed: true,
            channel: Channel::FixedRate(FixedRate::MIN),
        })
        .map_err(|e| anyhow!("Invalid subscription parameters: {}", e))?;

        let request = SubscribeRequest {
            subscription_id: SubscriptionId(subscription_id),
            params,
        };

        // Send subscription request through all active connections
        let connections = self.connections.lock().await;
        for connection in connections.iter() {
            let mut conn = connection.lock().await;
            if let Some(write) = &mut conn.write {
                let msg = serde_json::to_string(&Request::Subscribe(request.clone()))?;
                write.send(Message::Text(msg)).await?;
            }
        }

        self.active_subscriptions
            .lock()
            .await
            .insert(subscription_id, request);
        Ok(())
    }

    pub(crate) async fn handle_messages(
        mut read: WsSource,
        tx: broadcast::Sender<Response>,
        cache: Arc<Mutex<TtlCache<String, ()>>>,
    ) -> Result<()> {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    match serde_json::from_str::<Response>(&text) {
                        Ok(response) => {
                            // Check if we've seen this message recently
                            let msg_key = format!("{:?}", &response);
                            let mut cache = cache.lock().await;

                            if cache.contains_key(&msg_key) {
                                debug!("Dropping duplicate message");
                                continue;
                            }

                            // Cache the message with TTL
                            cache.insert(msg_key, (), DEDUP_TTL);

                            match &response {
                                Response::Error(err) => {
                                    error!("Server error: {}", err.error);
                                    return Err(anyhow!("Server error: {}", err.error));
                                }
                                Response::SubscriptionError(err) => {
                                    error!(
                                        "Subscription error for ID {}: {}",
                                        err.subscription_id.0, err.error
                                    );
                                    return Err(anyhow!("Subscription error: {}", err.error));
                                }
                                Response::StreamUpdated(update) => {
                                    debug!(
                                        "Received update for subscription {}",
                                        update.subscription_id.0
                                    );
                                }
                                _ => debug!("Received response: {:?}", response),
                            }

                            if let Err(e) = tx.send(response.clone()) {
                                error!("Failed to forward message to ticker stream: {}", e);
                                return Err(anyhow!("Failed to forward message: {}", e));
                            }

                            // Also send to the stream pool for redundancy
                            if let Err(e) = tx.send(response) {
                                error!("Failed to forward message to stream pool: {}", e);
                                return Err(anyhow!("Failed to forward message: {}", e));
                            }
                        }
                        Err(e) => {
                            error!("Failed to parse message: {}", e);
                            return Err(anyhow!("Failed to parse message: {}", e));
                        }
                    }
                }
                Ok(Message::Close(frame)) => {
                    info!("WebSocket connection closed by server: {:?}", frame);
                    return Ok(());
                }
                Ok(Message::Ping(_)) => {
                    debug!("Received ping");
                }
                Ok(Message::Pong(_)) => {
                    debug!("Received pong");
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    return Err(anyhow!("WebSocket error: {}", e));
                }
                _ => {}
            }
        }
        Ok(())
    }

    pub async fn unsubscribe(&mut self, subscription_id: u64) -> Result<()> {
        let request = UnsubscribeRequest {
            subscription_id: SubscriptionId(subscription_id),
        };

        // Send unsubscribe request through all active connections
        let connections = self.connections.lock().await;
        for connection in connections.iter() {
            let mut conn = connection.lock().await;
            if let Some(write) = &mut conn.write {
                let msg = serde_json::to_string(&Request::Unsubscribe(request.clone()))?;
                write.send(Message::Text(msg)).await?;
            }
        }

        self.active_subscriptions
            .lock()
            .await
            .remove(&subscription_id);
        Ok(())
    }

    pub fn subscribe_to_updates(&self) -> broadcast::Receiver<Response> {
        self.tx.subscribe()
    }

    /// Subscribe to the combined stream pool that receives messages from all connections
    pub fn subscribe_to_stream_pool(&self) -> broadcast::Receiver<Response> {
        self.stream_tx.subscribe()
    }
}
