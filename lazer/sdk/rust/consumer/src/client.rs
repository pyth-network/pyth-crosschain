use {
    anyhow::{Context, Result},
    tokio_stream,
    futures_util::{SinkExt, StreamExt},
    pyth_lazer_protocol::{
        router::{Channel, PriceFeedId, PriceFeedProperty, SubscriptionParams, SubscriptionParamsRepr, JsonUpdate},
        subscription::{Request, Response, SubscriptionId, SubscribeRequest, UnsubscribeRequest, StreamUpdatedResponse},
    },
    std::{
        sync::Arc,
        time::{Duration, Instant},
    },
    tokio::{
        net::TcpStream,
        sync::{mpsc, RwLock},
    },
    tokio_tungstenite::{
        connect_async,
        tungstenite::Message,
        MaybeTlsStream, WebSocketStream,
    },
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
    seen_updates: TtlCache<u64, bool>,
}

pub struct RedundantLazerClient {
    connections: Vec<Arc<RwLock<WebSocketState>>>,
    feed_ids: Vec<PriceFeedId>,
    properties: Vec<PriceFeedProperty>,
    channel: Channel,
    _timeout: Duration,
    endpoint: Url,
    subscription_id: Option<SubscriptionId>,
}

impl RedundantLazerClient {
    pub async fn new(
        endpoint: Url,
        num_connections: usize,
        timeout: Duration,
    ) -> Result<Self> {
        if num_connections > MAX_NUM_CONNECTIONS {
            anyhow::bail!("too many connections requested");
        }

        let mut connections = Vec::with_capacity(num_connections);
        for _ in 0..num_connections {
            let stream = connect_async(&endpoint).await?.0;
            connections.push(Arc::new(RwLock::new(WebSocketState {
                stream,
                created_at: Instant::now(),
                seen_updates: TtlCache::new(DEDUP_CACHE_SIZE),
            })));
        }

        Ok(Self {
            connections,

            feed_ids: Vec::new(),
            properties: Vec::new(),
            channel: Channel::FixedRate(pyth_lazer_protocol::router::FixedRate::MIN),
            _timeout: timeout,
            endpoint,
            subscription_id: None,
        })
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
            return self.update_subscription(feed_ids, properties, channel).await;
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
        }).map_err(|e| anyhow::anyhow!(e))?;

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
        let subscription_id = self.subscription_id.ok_or_else(|| anyhow::anyhow!("no active subscription"))?;
        let params = SubscriptionParams::new(SubscriptionParamsRepr {
            price_feed_ids: feed_ids.to_vec(),
            properties: properties.to_vec(),
            chains: vec![pyth_lazer_protocol::router::Chain::Evm],
            delivery_format: Default::default(),
            json_binary_encoding: Default::default(),
            parsed: true,
            channel,
        }).map_err(|e| anyhow::anyhow!(e))?;

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
                state.stream.send(Message::Text(message))
                    .await
                    .context("failed to send unsubscribe request")?;
            }
            self.feed_ids.clear();
            self.properties.clear();
        }
        Ok(())
    }

    pub async fn into_stream(
        self,
    ) -> Result<impl futures_util::Stream<Item = JsonUpdate>> {
        let (tx, rx) = mpsc::channel(STREAM_POOL_CHANNEL_SIZE);
        let mut response_rx = self.start().await?;
        
        tokio::spawn(async move {
            while let Some(response) = response_rx.recv().await {
                if let Response::StreamUpdated(StreamUpdatedResponse { payload, .. }) = response {
                    if tx.send(payload).await.is_err() {
                        break;
                    }
                }
            }
        });

        Ok(tokio_stream::wrappers::ReceiverStream::new(rx))
    }

    pub async fn start(
        self,
    ) -> Result<mpsc::Receiver<Response>> {
        let (tx, rx) = mpsc::channel(STREAM_POOL_CHANNEL_SIZE);
        let subscription_id = self.subscription_id.unwrap_or(SubscriptionId(1));
        let params = SubscriptionParams::new(SubscriptionParamsRepr {
            price_feed_ids: self.feed_ids.clone(),
            properties: self.properties.clone(),
            chains: vec![pyth_lazer_protocol::router::Chain::Evm],
            delivery_format: Default::default(),
            json_binary_encoding: Default::default(),
            parsed: true,
            channel: self.channel,
        }).map_err(|e| anyhow::anyhow!(e))?;

        for connection in self.connections {
            let tx = tx.clone();
            let endpoint = self.endpoint.clone();
            let params = params.clone();

            tokio::spawn(async move {
                loop {
                    let mut state = connection.write().await;
                    if Instant::now().duration_since(state.created_at) > CONNECTION_TTL {
                        if let Err(e) = Self::reconnect_connection(&endpoint, connection.clone()).await {
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
                                        Ok(response) => {
                                            match &response {
                                                Response::Subscribed(_) => {
                                                    info!("Subscription confirmed");
                                                }
                                                Response::SubscriptionError(error) => {
                                                    error!("Subscription error: {}", error.error);
                                                    break;
                                                }
                                                Response::StreamUpdated(StreamUpdatedResponse { subscription_id: _, payload }) => {
                                                    // Generate a unique ID for deduplication based on update content
                                                    let update_hash = {
                                                        use std::hash::{Hash, Hasher};
                                                        let mut hasher = std::collections::hash_map::DefaultHasher::new();
                                                        payload.hash(&mut hasher);
                                                        hasher.finish()
                                                    };

                                                    // Skip if we've seen this update recently
                                                    if state.seen_updates.get(&update_hash).is_some() {
                                                        continue;
                                                    }

                                                    // Insert into TTL cache and forward the update
                                                    state.seen_updates.insert(update_hash, true, DEDUP_TTL);
                                                    if tx.send(Response::StreamUpdated(StreamUpdatedResponse {
                                                        subscription_id,
                                                        payload: payload.clone(),
                                                    })).await.is_err() {
                                                        return;
                                                    }
                                                }
                                                _ => {
                                                    warn!("Unexpected response type: {:?}", response);
                                                }
                                            }
                                        }
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

                    if let Err(e) = Self::reconnect_connection(&endpoint, connection.clone()).await {
                        error!("Failed to reconnect: {}", e);
                        tokio::time::sleep(RECONNECT_WAIT).await;
                    }
                }
            });
        }

        Ok(rx)
    }
}
