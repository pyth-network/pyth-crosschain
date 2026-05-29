use {
    super::{
        token,
        types::{PriceIdInput, RpcPriceFeed},
        ApiState,
    },
    crate::state::{
        aggregate::{Aggregates, AggregationEvent, RequestTime},
        metrics::Metrics,
        Benchmarks, Cache, PriceFeedMeta,
    },
    anyhow::{anyhow, Result},
    axum::{
        extract::{
            ws::{Message, WebSocket, WebSocketUpgrade},
            State as AxumState,
        },
        http::HeaderMap,
        response::IntoResponse,
    },
    futures::{
        stream::{SplitSink, SplitStream},
        SinkExt, StreamExt,
    },
    governor::{DefaultKeyedRateLimiter, Quota, RateLimiter},
    ipnet::IpNet,
    nonzero_ext::nonzero,
    prometheus_client::{
        encoding::{EncodeLabelSet, EncodeLabelValue},
        metrics::{counter::Counter, family::Family},
    },
    pyth_sdk::PriceIdentifier,
    serde::{Deserialize, Serialize},
    std::{
        collections::HashMap,
        net::IpAddr,
        num::NonZeroU32,
        sync::{
            atomic::{AtomicUsize, Ordering},
            Arc,
        },
        time::Duration,
    },
    tokio::{
        sync::{broadcast::Receiver, watch},
        time::Instant,
    },
};

const PING_INTERVAL_DURATION: Duration = Duration::from_secs(30);
const MAX_CLIENT_MESSAGE_SIZE: usize = 1025 * 1024; // 1 MiB
const MAX_CONNECTION_DURATION: Duration = Duration::from_secs(24 * 60 * 60); // 24 hours

/// Maximum time a single websocket write (feed/flush/send/close) may take before
/// the client is treated as a slow consumer and the connection is closed.
///
/// Without this bound, a client that stops reading parks the connection task
/// inside `flush().await` (or `feed().await`) indefinitely — until the OS TCP
/// timeout, which can be hours. While parked there, none of the sibling
/// `tokio::select!` branches (the ping check and the 24h deadline) can fire, so
/// the connection — its task, its write buffer, and its broadcast receiver slot
/// — stays pinned in memory. Accumulating such stalled connections is the source
/// of the server's unbounded memory growth, so we cap every write here.
const WS_SEND_TIMEOUT: Duration = Duration::from_secs(10);

/// The maximum number of bytes that can be sent per second per IP address.
/// If the limit is exceeded, the connection is closed.
const BYTES_LIMIT_PER_IP_PER_SECOND: u32 = 256 * 1024; // 256 KiB

#[derive(Clone)]
pub struct PriceFeedClientConfig {
    verbose: bool,
    binary: bool,
    allow_out_of_order: bool,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelValue)]
pub enum Interaction {
    NewConnection,
    CloseConnection,
    ClientHeartbeat,
    PriceUpdate,
    ClientMessage,
    RateLimit,
    SlowConsumer,
    ConnectionTimeout,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelValue)]
pub enum Status {
    Success,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, EncodeLabelSet)]
pub struct Labels {
    pub interaction: Interaction,
    pub status: Status,
    /// Last 4 characters of the API token, or "none" if no token provided
    pub token_suffix: String,
}

pub struct WsMetrics {
    pub interactions: Family<Labels, Counter>,
    pub broadcast_latency: prometheus_client::metrics::histogram::Histogram,
}

impl WsMetrics {
    pub fn new<S>(state: Arc<S>) -> Self
    where
        S: Metrics,
        S: Send + Sync + 'static,
    {
        let new = Self {
            interactions: Family::default(),
            broadcast_latency: prometheus_client::metrics::histogram::Histogram::new(
                [
                    0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0,
                ]
                .into_iter(),
            ),
        };

        {
            let interactions = new.interactions.clone();
            let ws_broadcast_latency = new.broadcast_latency.clone();

            tokio::spawn(async move {
                Metrics::register(
                    &*state,
                    (
                        "ws_interactions",
                        "Total number of websocket interactions",
                        interactions,
                    ),
                )
                .await;

                Metrics::register(
                    &*state,
                    (
                        "ws_broadcast_latency_seconds",
                        "Latency from Hermes receive_time to WS send in seconds",
                        ws_broadcast_latency,
                    ),
                )
                .await;
            });
        }

        new
    }
}

pub struct WsState {
    pub subscriber_counter: AtomicUsize,
    pub bytes_limit_whitelist: Vec<IpNet>,
    pub rate_limiter: DefaultKeyedRateLimiter<IpAddr>,
    pub requester_ip_header_name: String,
    pub metrics: WsMetrics,
}

impl WsState {
    pub fn new<S>(whitelist: Vec<IpNet>, requester_ip_header_name: String, state: Arc<S>) -> Self
    where
        S: Metrics,
        S: Send + Sync + 'static,
    {
        Self {
            subscriber_counter: AtomicUsize::new(0),
            rate_limiter: RateLimiter::dashmap(Quota::per_second(nonzero!(
                BYTES_LIMIT_PER_IP_PER_SECOND
            ))),
            bytes_limit_whitelist: whitelist,
            requester_ip_header_name,
            metrics: WsMetrics::new(state.clone()),
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "subscribe")]
    Subscribe {
        ids: Vec<PriceIdInput>,
        #[serde(default)]
        verbose: bool,
        #[serde(default)]
        binary: bool,
        #[serde(default)]
        allow_out_of_order: bool,
        #[serde(default)]
        ignore_invalid_price_ids: bool,
    },
    #[serde(rename = "unsubscribe")]
    Unsubscribe { ids: Vec<PriceIdInput> },
}

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type")]
enum ServerMessage {
    #[serde(rename = "response")]
    Response(ServerResponseMessage),
    #[serde(rename = "price_update")]
    PriceUpdate { price_feed: RpcPriceFeed },
}

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "status")]
enum ServerResponseMessage {
    #[serde(rename = "success")]
    Success,
    #[serde(rename = "error")]
    Err { error: String },
}

pub async fn ws_route_handler<S>(
    ws: WebSocketUpgrade,
    AxumState(state): AxumState<ApiState<S>>,
    headers: HeaderMap,
    uri: axum::http::Uri,
) -> impl IntoResponse
where
    S: Aggregates,
    S: Benchmarks,
    S: Cache,
    S: PriceFeedMeta,
    S: Send + Sync + 'static,
{
    let requester_ip = headers
        .get(state.ws.requester_ip_header_name.as_str())
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next()) // Only take the first ip if there are multiple
        .and_then(|value| value.parse().ok());

    // Extract the token from the request
    let api_token = token::extract_token_from_headers_and_uri(&headers, &uri);
    let token_suffix = token::get_token_suffix(api_token.as_deref());

    ws.max_message_size(MAX_CLIENT_MESSAGE_SIZE)
        .on_upgrade(move |socket| websocket_handler(socket, state, requester_ip, token_suffix))
}

#[tracing::instrument(skip(stream, state, subscriber_ip, token_suffix))]
async fn websocket_handler<S>(
    stream: WebSocket,
    state: ApiState<S>,
    subscriber_ip: Option<IpAddr>,
    token_suffix: String,
) where
    S: Aggregates,
    S: Send,
{
    let ws_state = state.ws.clone();

    // Retain the recent rate limit data for the IP addresses to
    // prevent the rate limiter size from growing indefinitely.
    ws_state.rate_limiter.retain_recent();

    let id = ws_state.subscriber_counter.fetch_add(1, Ordering::SeqCst);

    tracing::debug!(id, ?subscriber_ip, "New Websocket Connection");
    ws_state
        .metrics
        .interactions
        .get_or_create(&Labels {
            interaction: Interaction::NewConnection,
            status: Status::Success,
            token_suffix: token_suffix.clone(),
        })
        .inc();

    let notify_receiver = Aggregates::subscribe(&*state.state);
    let (sender, receiver) = stream.split();
    let mut subscriber = Subscriber::new(
        id,
        subscriber_ip,
        token_suffix,
        state.state.clone(),
        state.ws.clone(),
        notify_receiver,
        receiver,
        sender,
    );

    subscriber.run().await;
}

pub type SubscriberId = usize;

/// Subscriber is an actor that handles a single websocket connection.
/// It listens to the store for updates and sends them to the client.
pub struct Subscriber<S> {
    id: SubscriberId,
    ip_addr: Option<IpAddr>,
    token_suffix: String,
    closed: bool,
    state: Arc<S>,
    ws_state: Arc<WsState>,
    notify_receiver: Receiver<AggregationEvent>,
    receiver: SplitStream<WebSocket>,
    sender: SplitSink<WebSocket, Message>,
    price_feeds_with_config: HashMap<PriceIdentifier, PriceFeedClientConfig>,
    ping_interval: tokio::time::Interval,
    connection_deadline: Instant,
    exit: watch::Receiver<bool>,
    responded_to_ping: bool,
}

impl<S> Subscriber<S>
where
    S: Aggregates,
{
    #[allow(
        clippy::too_many_arguments,
        reason = "constructor requires all fields for Subscriber"
    )]
    pub fn new(
        id: SubscriberId,
        ip_addr: Option<IpAddr>,
        token_suffix: String,
        state: Arc<S>,
        ws_state: Arc<WsState>,
        notify_receiver: Receiver<AggregationEvent>,
        receiver: SplitStream<WebSocket>,
        sender: SplitSink<WebSocket, Message>,
    ) -> Self {
        Self {
            id,
            ip_addr,
            token_suffix,
            closed: false,
            state,
            ws_state,
            notify_receiver,
            receiver,
            sender,
            price_feeds_with_config: HashMap::new(),
            ping_interval: tokio::time::interval(PING_INTERVAL_DURATION),
            connection_deadline: Instant::now() + MAX_CONNECTION_DURATION,
            exit: crate::EXIT.subscribe(),
            responded_to_ping: true, // We start with true so we don't close the connection immediately
        }
    }

    /// Sends a message to the client, closing the connection (by returning an
    /// error) if the write does not complete within [`WS_SEND_TIMEOUT`]. See the
    /// constant's docs for why this slow-consumer bound is required.
    async fn send_to_client(&mut self, message: Message) -> Result<()> {
        match tokio::time::timeout(WS_SEND_TIMEOUT, self.sender.send(message)).await {
            Ok(result) => result.map_err(anyhow::Error::from),
            Err(_) => Err(self.slow_consumer_error()),
        }
    }

    /// Buffers a message for the client (without flushing), bounded by
    /// [`WS_SEND_TIMEOUT`] for slow-consumer protection.
    async fn feed_to_client(&mut self, message: Message) -> Result<()> {
        match tokio::time::timeout(WS_SEND_TIMEOUT, self.sender.feed(message)).await {
            Ok(result) => result.map_err(anyhow::Error::from),
            Err(_) => Err(self.slow_consumer_error()),
        }
    }

    /// Flushes buffered messages to the client, bounded by [`WS_SEND_TIMEOUT`].
    /// This is where backpressure from a slow consumer surfaces, so the timeout
    /// here is what actually reclaims a stalled connection.
    async fn flush_to_client(&mut self) -> Result<()> {
        match tokio::time::timeout(WS_SEND_TIMEOUT, self.sender.flush()).await {
            Ok(result) => result.map_err(anyhow::Error::from),
            Err(_) => Err(self.slow_consumer_error()),
        }
    }

    /// Closes the connection, bounded by [`WS_SEND_TIMEOUT`] so that flushing the
    /// close frame to a slow consumer cannot block shutdown indefinitely. A
    /// timeout here is *not* attributed as a slow consumer: closing is
    /// best-effort teardown (e.g. mass closes during a deploy can legitimately
    /// back up), and the connection is dropped regardless.
    async fn close_client(&mut self) -> Result<()> {
        match tokio::time::timeout(WS_SEND_TIMEOUT, self.sender.close()).await {
            Ok(result) => result.map_err(anyhow::Error::from),
            Err(_) => {
                tracing::debug!(id = self.id, ip = ?self.ip_addr, "Websocket close timed out.");
                Err(anyhow!("websocket close timed out"))
            }
        }
    }

    /// Records a slow-consumer disconnect (log + metric) and builds the error
    /// returned from the write helpers to tear the connection down.
    fn slow_consumer_error(&self) -> anyhow::Error {
        tracing::info!(
            id = self.id,
            ip = ?self.ip_addr,
            "Slow consumer detected (write exceeded {:?}). Closing connection.",
            WS_SEND_TIMEOUT,
        );
        self.ws_state
            .metrics
            .interactions
            .get_or_create(&Labels {
                interaction: Interaction::SlowConsumer,
                status: Status::Error,
                token_suffix: self.token_suffix.clone(),
            })
            .inc();
        anyhow!("Slow consumer: websocket write exceeded {:?}", WS_SEND_TIMEOUT)
    }

    #[tracing::instrument(skip(self))]
    pub async fn run(&mut self) {
        while !self.closed {
            if let Err(e) = self.handle_next().await {
                tracing::debug!(subscriber = self.id, error = ?e, "Error Handling Subscriber Message.");
                break;
            }
        }
    }

    async fn handle_next(&mut self) -> Result<()> {
        tokio::select! {
            maybe_update_feeds_event = self.notify_receiver.recv() => {
                match maybe_update_feeds_event {
                    Ok(event) => self.handle_price_feeds_update(event).await,
                    Err(e) => Err(anyhow!("Failed to receive update from store: {:?}", e)),
                }
            },
            maybe_message_or_err = self.receiver.next() => {
                self.handle_client_message(
                    maybe_message_or_err.ok_or(anyhow!("Client channel is closed"))??
                ).await
            },
            _  = self.ping_interval.tick() => {
                if !self.responded_to_ping {
                    self.ws_state
                        .metrics
                        .interactions
                        .get_or_create(&Labels {
                            interaction: Interaction::ClientHeartbeat,
                            status: Status::Error,
                            token_suffix: self.token_suffix.clone(),
                        })
                        .inc();

                    return Err(anyhow!("Subscriber did not respond to ping. Closing connection."));
                }
                self.responded_to_ping = false;
                self.send_to_client(Message::Ping(vec![])).await?;
                Ok(())
            },
            _ = tokio::time::sleep_until(self.connection_deadline) => {
                tracing::info!(
                    id = self.id,
                    ip = ?self.ip_addr,
                    "Connection timeout reached (24h). Closing connection.",
                );
                self.ws_state
                    .metrics
                    .interactions
                    .get_or_create(&Labels {
                        interaction: Interaction::ConnectionTimeout,
                        status: Status::Success,
                        token_suffix: self.token_suffix.clone(),
                    })
                    .inc();
                // Best-effort final message + close. A deadline teardown is
                // attributed to ConnectionTimeout only: we do NOT route these
                // through the slow-consumer helpers, so an idle/slow client at the
                // 24h mark is not also miscounted as a slow consumer.
                let goodbye = serde_json::to_string(&ServerMessage::Response(
                    ServerResponseMessage::Err {
                        error: "Connection timeout reached (24h)".to_string(),
                    },
                ))?;
                let _ = tokio::time::timeout(WS_SEND_TIMEOUT, self.sender.send(goodbye.into())).await;
                let _ = self.close_client().await;
                self.closed = true;
                Ok(())
            },
            _ = self.exit.changed() => {
                self.close_client().await?;
                self.closed = true;
                Err(anyhow!("Application is shutting down. Closing connection."))
            }
        }
    }

    async fn handle_price_feeds_update(&mut self, event: AggregationEvent) -> Result<()> {
        let price_feed_ids = self
            .price_feeds_with_config
            .keys()
            .cloned()
            .collect::<Vec<_>>();

        let state = &*self.state;
        let updates = match Aggregates::get_price_feeds_with_update_data(
            state,
            &price_feed_ids,
            RequestTime::AtSlot(event.slot()),
        )
        .await
        {
            Ok(updates) => updates,
            Err(_) => {
                // The error can only happen when a price feed was available
                // and is no longer there as we check the price feed ids upon
                // subscription. In this case we just remove the non-existing
                // price feed from the list and will keep sending updates for
                // the rest.
                let available_price_feed_ids = Aggregates::get_price_feed_ids(state).await;

                self.price_feeds_with_config
                    .retain(|price_feed_id, _| available_price_feed_ids.contains(price_feed_id));

                let price_feed_ids = self
                    .price_feeds_with_config
                    .keys()
                    .cloned()
                    .collect::<Vec<_>>();

                Aggregates::get_price_feeds_with_update_data(
                    state,
                    &price_feed_ids,
                    RequestTime::AtSlot(event.slot()),
                )
                .await?
            }
        };

        // Capture the minimum receive_time from the updates batch
        let min_received_at = updates
            .price_feeds
            .iter()
            .filter_map(|update| update.received_at)
            .min();

        for update in updates.price_feeds {
            let config = self
                .price_feeds_with_config
                .get(&update.price_feed.id)
                .ok_or(anyhow::anyhow!(
                    "Config missing, price feed list was poisoned during iteration."
                ))?;

            if let AggregationEvent::OutOfOrder { slot: _ } = event {
                if !config.allow_out_of_order {
                    continue;
                }
            }

            let message = serde_json::to_string(&ServerMessage::PriceUpdate {
                price_feed: RpcPriceFeed::from_price_feed_update(
                    update,
                    config.verbose,
                    config.binary,
                ),
            })?;

            // Close the connection if rate limit is exceeded and the ip is not whitelisted.
            // If the ip address is None no rate limiting is applied.
            if let Some(ip_addr) = self.ip_addr {
                if !self
                    .ws_state
                    .bytes_limit_whitelist
                    .iter()
                    .any(|ip_net| ip_net.contains(&ip_addr))
                    && self.ws_state.rate_limiter.check_key_n(
                        &ip_addr,
                        NonZeroU32::new(message.len().try_into()?)
                            .ok_or(anyhow!("Empty message"))?,
                    ) != Ok(Ok(()))
                {
                    tracing::info!(
                        self.id,
                        ip = %ip_addr,
                        "Rate limit exceeded. Closing connection.",
                    );
                    self.ws_state
                        .metrics
                        .interactions
                        .get_or_create(&Labels {
                            interaction: Interaction::RateLimit,
                            status: Status::Error,
                            token_suffix: self.token_suffix.clone(),
                        })
                        .inc();

                    self.send_to_client(
                        serde_json::to_string(&ServerResponseMessage::Err {
                            error: "Rate limit exceeded".to_string(),
                        })?
                        .into(),
                    )
                    .await?;
                    self.close_client().await?;
                    self.closed = true;
                    return Ok(());
                }
            }

            // `sender.feed` buffers a message to the client but does not flush it, so we can send
            // multiple messages and flush them all at once.
            self.feed_to_client(message.into()).await?;

            self.ws_state
                .metrics
                .interactions
                .get_or_create(&Labels {
                    interaction: Interaction::PriceUpdate,
                    status: Status::Success,
                    token_suffix: self.token_suffix.clone(),
                })
                .inc();
        }

        self.flush_to_client().await?;

        // Record latency from receive to ws send after flushing
        if let Some(min_received_at) = min_received_at {
            let now_secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs_f64())
                .unwrap_or(0.0);
            // Histogram only accepts f64. The conversion is safe (never panics), but very large values lose precision.
            let latency = now_secs - (min_received_at as f64);
            self.ws_state
                .metrics
                .broadcast_latency
                .observe(latency.max(0.0));
        }

        Ok(())
    }

    #[tracing::instrument(skip(self, message))]
    async fn handle_client_message(&mut self, message: Message) -> Result<()> {
        let maybe_client_message = match message {
            Message::Close(_) => {
                // Closing the connection. We don't remove it from the subscribers
                // list, instead when the Subscriber struct is dropped the channel
                // to subscribers list will be closed and it will eventually get
                // removed.
                tracing::trace!(id = self.id, "Subscriber Closed Connection.");
                self.ws_state
                    .metrics
                    .interactions
                    .get_or_create(&Labels {
                        interaction: Interaction::CloseConnection,
                        status: Status::Success,
                        token_suffix: self.token_suffix.clone(),
                    })
                    .inc();

                // Send the close message to gracefully shut down the connection
                // Otherwise the client might get an abnormal Websocket closure
                // error.
                self.close_client().await?;
                self.closed = true;
                return Ok(());
            }
            Message::Text(text) => serde_json::from_str::<ClientMessage>(&text),
            Message::Binary(data) => serde_json::from_slice::<ClientMessage>(&data),
            Message::Ping(_) => {
                // Axum will send Pong automatically
                return Ok(());
            }
            Message::Pong(_) => {
                // This metric can be used to monitor the number of active connections
                self.ws_state
                    .metrics
                    .interactions
                    .get_or_create(&Labels {
                        interaction: Interaction::ClientHeartbeat,
                        status: Status::Success,
                        token_suffix: self.token_suffix.clone(),
                    })
                    .inc();

                self.responded_to_ping = true;
                return Ok(());
            }
        };

        match maybe_client_message {
            Err(e) => {
                self.ws_state
                    .metrics
                    .interactions
                    .get_or_create(&Labels {
                        interaction: Interaction::ClientMessage,
                        status: Status::Error,
                        token_suffix: self.token_suffix.clone(),
                    })
                    .inc();
                self.send_to_client(
                    serde_json::to_string(&ServerMessage::Response(
                        ServerResponseMessage::Err {
                            error: e.to_string(),
                        },
                    ))?
                    .into(),
                )
                .await?;
                return Ok(());
            }

            Ok(ClientMessage::Subscribe {
                ids,
                verbose,
                binary,
                allow_out_of_order,
                ignore_invalid_price_ids,
            }) => {
                let price_ids: Vec<PriceIdentifier> = ids.into_iter().map(|id| id.into()).collect();
                let available_price_ids = Aggregates::get_price_feed_ids(&*self.state).await;

                let (found_price_ids, not_found_price_ids): (
                    Vec<&PriceIdentifier>,
                    Vec<&PriceIdentifier>,
                ) = price_ids
                    .iter()
                    .partition(|price_id| available_price_ids.contains(price_id));

                // If there is a single price id that is not found, we don't subscribe to any of the
                // asked correct price feed ids and return an error to be more explicit and clear,
                // unless the client explicitly asked to ignore invalid ids
                if !not_found_price_ids.is_empty() && !ignore_invalid_price_ids {
                    self.send_to_client(
                        serde_json::to_string(&ServerMessage::Response(
                            ServerResponseMessage::Err {
                                error: format!(
                                    "Price feed(s) with id(s) {not_found_price_ids:?} not found",
                                ),
                            },
                        ))?
                        .into(),
                    )
                    .await?;
                    return Ok(());
                } else {
                    for price_id in found_price_ids {
                        self.price_feeds_with_config.insert(
                            *price_id,
                            PriceFeedClientConfig {
                                verbose,
                                binary,
                                allow_out_of_order,
                            },
                        );
                    }
                }
            }
            Ok(ClientMessage::Unsubscribe { ids }) => {
                for id in ids {
                    let price_id: PriceIdentifier = id.into();
                    self.price_feeds_with_config.remove(&price_id);
                }
            }
        }

        self.ws_state
            .metrics
            .interactions
            .get_or_create(&Labels {
                interaction: Interaction::ClientMessage,
                status: Status::Success,
                token_suffix: self.token_suffix.clone(),
            })
            .inc();

        self.send_to_client(
            serde_json::to_string(&ServerMessage::Response(ServerResponseMessage::Success))?
                .into(),
        )
        .await?;

        Ok(())
    }
}
