use {
    anyhow::{Context, Result},
    futures_util::{SinkExt, StreamExt},
    pyth_lazer_protocol::{
        router::{
            Channel, JsonUpdate, PriceFeedId, PriceFeedProperty, SubscriptionParams,
            SubscriptionParamsRepr,
        },
        subscription::{
            Request, Response, StreamUpdatedResponse, SubscribeRequest, SubscriptionId,
            UnsubscribeRequest,
        },
    },
    std::{
        sync::Arc,
        time::{Duration, Instant},
    },
    tokio::sync::Mutex,
    tokio::{
        net::TcpStream,
        sync::{mpsc, RwLock},
    },
    tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream},
    tracing::{error, info, warn},
    ttl_cache::TtlCache,
    url::Url,
};

const STREAM_POOL_CHANNEL_SIZE: usize = 100_000;
const DEDUP_CACHE_SIZE: usize = 100_000;
const DEDUP_TTL: Duration = Duration::from_secs(10);
const RECONNECT_WAIT: Duration = Duration::from_secs(1);
const MAX_NUM_CONNECTIONS: usize = 50;
const CONNECTION_TTL: Duration = Duration::from_secs(23 * 60 * 60); // 23 hours

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

struct WebSocketState {
    stream: WsStream,
    created_at: Instant,
}

pub struct RedundantLazerClient {
    connections: Vec<Arc<RwLock<WebSocketState>>>,
    feed_ids: Vec<PriceFeedId>,
    properties: Vec<PriceFeedProperty>,
    channel: Channel,
    _timeout: Duration,
    endpoint: Url,
    subscription_id: Option<SubscriptionId>,
    seen_updates: Arc<RwLock<TtlCache<String, bool>>>,
    was_all_down: Arc<RwLock<bool>>,
    connection_state_tx: mpsc::UnboundedSender<bool>,
    connection_state_rx: Arc<Mutex<mpsc::UnboundedReceiver<bool>>>,
}

impl Clone for RedundantLazerClient {
    fn clone(&self) -> Self {
        Self {
            connections: self.connections.clone(),
            feed_ids: self.feed_ids.clone(),
            properties: self.properties.clone(),
            channel: self.channel,
            _timeout: self._timeout,
            endpoint: self.endpoint.clone(),
            subscription_id: self.subscription_id,
            seen_updates: self.seen_updates.clone(),
            was_all_down: self.was_all_down.clone(),
            connection_state_tx: self.connection_state_tx.clone(),
            connection_state_rx: Arc::clone(&self.connection_state_rx),
        }
    }
}

impl RedundantLazerClient {
    pub async fn new(endpoint: Url, num_connections: usize, timeout: Duration) -> Result<Self> {
        if num_connections > MAX_NUM_CONNECTIONS {
            anyhow::bail!("too many connections requested");
        }

        let mut connections = Vec::with_capacity(num_connections);
        for _ in 0..num_connections {
            let stream = connect_async(&endpoint).await?.0;
            connections.push(Arc::new(RwLock::new(WebSocketState {
                stream,
                created_at: Instant::now(),
            })));
        }

        let (connection_state_tx, rx) = mpsc::unbounded_channel();
        let connection_state_rx = Arc::new(Mutex::new(rx));
        Ok(Self {
            connections,
            feed_ids: Vec::new(),
            properties: Vec::new(),
            channel: Channel::FixedRate(pyth_lazer_protocol::router::FixedRate::MIN),
            _timeout: timeout,
            endpoint,
            subscription_id: None,
            seen_updates: Arc::new(RwLock::new(TtlCache::new(DEDUP_CACHE_SIZE))),
            was_all_down: Arc::new(RwLock::new(false)),
            connection_state_tx,
            connection_state_rx,
        })
    }

    pub fn get_connection_state_receiver(&self) -> mpsc::UnboundedReceiver<bool> {
        let (tx, rx) = mpsc::unbounded_channel();
        let state_rx = Arc::clone(&self.connection_state_rx);
        tokio::spawn(async move {
            let mut rx = state_rx.lock().await;
            while let Some(state) = rx.recv().await {
                if tx.send(state).is_err() {
                    break;
                }
            }
        });
        rx
    }

    #[allow(dead_code)]
    async fn check_connection_states(&self) {
        let mut all_down = true;
        for connection in &self.connections {
            let state = connection.read().await;
            if Instant::now().duration_since(state.created_at) <= CONNECTION_TTL {
                all_down = false;
                break;
            }
        }

        let mut was_down = self.was_all_down.write().await;
        if all_down && !*was_down {
            *was_down = true;
            error!("All WebSocket connections are down or reconnecting");
            let _ = self.connection_state_tx.send(true);
        } else if !all_down && *was_down {
            *was_down = false;
            let _ = self.connection_state_tx.send(false);
        }
    }

    async fn reconnect_connection(
        endpoint: &Url,
        connection: Arc<RwLock<WebSocketState>>,
    ) -> Result<()> {
        let stream = connect_async(endpoint).await?.0;
        let mut state = connection.write().await;
        state.stream = stream;
        state.created_at = Instant::now();
        Ok(())
    }

    async fn send_subscribe_request(
        stream: &mut WsStream,
        subscription_id: SubscriptionId,
        params: SubscriptionParams,
    ) -> Result<()> {
        let request = Request::Subscribe(SubscribeRequest {
            subscription_id,
            params,
        });
        let message = serde_json::to_string(&request)?;
        stream.send(Message::Text(message)).await?;
        Ok(())
    }

    pub async fn subscribe(
        &mut self,
        feed_ids: &[PriceFeedId],
        properties: &[PriceFeedProperty],
        channel: Channel,
    ) -> Result<()> {
        if self.subscription_id.is_some() {
            return self
                .update_subscription(feed_ids, properties, channel)
                .await;
        }

        let subscription_id = SubscriptionId(1);
        let params = SubscriptionParams::new(SubscriptionParamsRepr {
            price_feed_ids: feed_ids.to_vec(),
            properties: properties.to_vec(),
            chains: vec![pyth_lazer_protocol::router::Chain::Evm],
            delivery_format: Default::default(),
            json_binary_encoding: Default::default(),
            parsed: true,
            channel,
        })
        .map_err(|e| anyhow::anyhow!(e))?;

        for connection in &self.connections {
            let mut state = connection.write().await;
            Self::send_subscribe_request(&mut state.stream, subscription_id, params.clone())
                .await
                .context("failed to send initial subscription request")?;
        }

        self.feed_ids = feed_ids.to_vec();
        self.properties = properties.to_vec();
        self.channel = channel;
        self.subscription_id = Some(subscription_id);
        Ok(())
    }

    pub async fn update_subscription(
        &mut self,
        feed_ids: &[PriceFeedId],
        properties: &[PriceFeedProperty],
        channel: Channel,
    ) -> Result<()> {
        let subscription_id = self
            .subscription_id
            .ok_or_else(|| anyhow::anyhow!("no active subscription"))?;
        let params = SubscriptionParams::new(SubscriptionParamsRepr {
            price_feed_ids: feed_ids.to_vec(),
            properties: properties.to_vec(),
            chains: vec![pyth_lazer_protocol::router::Chain::Evm],
            delivery_format: Default::default(),
            json_binary_encoding: Default::default(),
            parsed: true,
            channel,
        })
        .map_err(|e| anyhow::anyhow!(e))?;

        for connection in &self.connections {
            let mut state = connection.write().await;
            let request = Request::Subscribe(SubscribeRequest {
                subscription_id,
                params: params.clone(),
            });
            let message = serde_json::to_string(&request)?;
            state.stream.send(Message::Text(message)).await?;
        }

        self.feed_ids = feed_ids.to_vec();
        self.properties = properties.to_vec();
        self.channel = channel;
        Ok(())
    }

    pub async fn unsubscribe(&mut self) -> Result<()> {
        if let Some(subscription_id) = self.subscription_id.take() {
            for connection in &self.connections {
                let mut state = connection.write().await;
                let request = Request::Unsubscribe(UnsubscribeRequest { subscription_id });
                let message = serde_json::to_string(&request)?;
                state
                    .stream
                    .send(Message::Text(message))
                    .await
                    .context("failed to send unsubscribe request")?;
            }
            self.feed_ids.clear();
            self.properties.clear();
        }
        Ok(())
    }

    pub async fn into_stream(self) -> Result<impl futures_util::Stream<Item = Result<JsonUpdate>>> {
        let (tx, rx) = mpsc::channel(STREAM_POOL_CHANNEL_SIZE);
        let mut response_rx = self.start().await?;
        tokio::spawn(async move {
            while let Some(response) = response_rx.recv().await {
                match response {
                    Response::StreamUpdated(StreamUpdatedResponse { payload, .. }) => {
                        if tx.send(Ok(payload)).await.is_err() {
                            break;
                        }
                    }
                    Response::SubscriptionError(error) => {
                        let err = anyhow::anyhow!(
                            "Error occurred for subscription ID {}: {}",
                            error.subscription_id.0,
                            error.error
                        );
                        if tx.send(Err(err)).await.is_err() {
                            break;
                        }
                    }
                    Response::Error(error) => {
                        let err = anyhow::anyhow!("Error: {}", error.error);
                        if tx.send(Err(err)).await.is_err() {
                            break;
                        }
                    }
                    _ => {}
                }
            }
        });

        Ok(tokio_stream::wrappers::ReceiverStream::new(rx))
    }

    pub async fn start(self) -> Result<mpsc::Receiver<Response>> {
        let (tx, rx) = mpsc::channel(STREAM_POOL_CHANNEL_SIZE);
        let subscription_id = self.subscription_id.unwrap_or(SubscriptionId(1));
        let seen_updates = Arc::clone(&self.seen_updates);
        let connections = self.connections.clone();
        let endpoint = self.endpoint.clone();
        let params = SubscriptionParams::new(SubscriptionParamsRepr {
            price_feed_ids: self.feed_ids.clone(),
            properties: self.properties.clone(),
            chains: vec![pyth_lazer_protocol::router::Chain::Evm],
            delivery_format: Default::default(),
            json_binary_encoding: Default::default(),
            parsed: true,
            channel: self.channel,
        })
        .map_err(|e| anyhow::anyhow!(e))?;

        for connection in &connections {
            let tx = tx.clone();
            let endpoint = endpoint.clone();
            let params = params.clone();
            let seen_updates = Arc::clone(&seen_updates);
            let connection = Arc::clone(connection);

            tokio::spawn(async move {
                loop {
                    let mut state = connection.write().await;
                    if Instant::now().duration_since(state.created_at) > CONNECTION_TTL {
                        if let Err(e) =
                            Self::reconnect_connection(&endpoint, connection.clone()).await
                        {
                            error!("Failed to reconnect: {}", e);
                            tokio::time::sleep(RECONNECT_WAIT).await;
                            continue;
                        }
                        state = connection.write().await;
                    }

                    if let Err(e) = Self::send_subscribe_request(
                        &mut state.stream,
                        subscription_id,
                        params.clone(),
                    )
                    .await
                    .context("failed to send subscription request")
                    {
                        error!("Failed to send subscribe request: {}", e);
                        tokio::time::sleep(RECONNECT_WAIT).await;
                        continue;
                    }

                    drop(state);

                    loop {
                        let mut state = connection.write().await;
                        match state.stream.next().await {
                            Some(Ok(msg)) => match msg {
                                Message::Text(text) => {
                                    match serde_json::from_str::<Response>(&text) {
                                        Ok(response) => match &response {
                                            Response::Subscribed(_) => {
                                                info!("Subscription confirmed");
                                            }
                                            Response::SubscriptionError(error) => {
                                                let err_msg = format!(
                                                    "Error occurred for subscription ID {}: {}",
                                                    error.subscription_id.0, error.error
                                                );
                                                error!("{}", err_msg);
                                                if let Err(e) = tx
                                                    .send(Response::SubscriptionError(
                                                        error.clone(),
                                                    ))
                                                    .await
                                                {
                                                    error!(
                                                        "Failed to forward subscription error: {}",
                                                        e
                                                    );
                                                }
                                                break;
                                            }
                                            Response::StreamUpdated(StreamUpdatedResponse {
                                                subscription_id: _,
                                                payload,
                                            }) => {
                                                let message = serde_json::to_string(
                                                    &Response::StreamUpdated(
                                                        StreamUpdatedResponse {
                                                            subscription_id,
                                                            payload: payload.clone(),
                                                        },
                                                    ),
                                                )
                                                .map_err(|e| {
                                                    error!("Failed to serialize message: {}", e);
                                                })
                                                .unwrap_or_default();

                                                let mut cache = seen_updates.write().await;
                                                if cache.get(&message).is_some() {
                                                    continue;
                                                }

                                                cache.insert(message, true, DEDUP_TTL);
                                                if tx
                                                    .send(Response::StreamUpdated(
                                                        StreamUpdatedResponse {
                                                            subscription_id,
                                                            payload: payload.clone(),
                                                        },
                                                    ))
                                                    .await
                                                    .is_err()
                                                {
                                                    return;
                                                }
                                            }
                                            Response::Error(error) => {
                                                let err_msg = format!("Error: {}", error.error);
                                                error!("{}", err_msg);
                                                if let Err(e) =
                                                    tx.send(Response::Error(error.clone())).await
                                                {
                                                    error!("Failed to forward error: {}", e);
                                                }
                                                break;
                                            }
                                            _ => {
                                                warn!("Unexpected response type: {:?}", response);
                                            }
                                        },
                                        Err(e) => {
                                            warn!("Failed to parse response: {}", e);
                                        }
                                    }
                                }
                                Message::Close(_) => break,
                                _ => {}
                            },
                            Some(Err(e)) => {
                                error!("WebSocket error: {}", e);
                                break;
                            }
                            None => break,
                        }
                    }

                    if let Err(e) = Self::reconnect_connection(&endpoint, connection.clone()).await
                    {
                        error!("Failed to reconnect: {}", e);
                        tokio::time::sleep(RECONNECT_WAIT).await;
                    }
                }
            });
        }

        // Spawn connection state monitoring task
        let connections_monitor = connections.clone();
        let was_all_down = Arc::clone(&self.was_all_down);
        let connection_state_tx = self.connection_state_tx.clone();
        tokio::spawn(async move {
            loop {
                let mut all_down = true;
                for connection in &connections_monitor {
                    let state = connection.read().await;
                    if Instant::now().duration_since(state.created_at) <= CONNECTION_TTL {
                        all_down = false;
                        break;
                    }
                }

                let mut was_down = was_all_down.write().await;
                if all_down && !*was_down {
                    *was_down = true;
                    error!("All WebSocket connections are down or reconnecting");
                    let _ = connection_state_tx.send(true);
                } else if !all_down && *was_down {
                    *was_down = false;
                    let _ = connection_state_tx.send(false);
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        });

        Ok(rx)
    }
}
