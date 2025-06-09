use {
    super::{
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
}

pub struct WsMetrics {
    pub interactions: Family<Labels, Counter>,
}

impl WsMetrics {
    pub fn new<S>(state: Arc<S>) -> Self
    where
        S: Metrics,
        S: Send + Sync + 'static,
    {
        let new = Self {
            interactions: Family::default(),
        };

        {
            let interactions = new.interactions.clone();

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

    ws.max_message_size(MAX_CLIENT_MESSAGE_SIZE)
        .on_upgrade(move |socket| websocket_handler(socket, state, requester_ip))
}

#[tracing::instrument(skip(stream, state, subscriber_ip))]
async fn websocket_handler<S>(stream: WebSocket, state: ApiState<S>, subscriber_ip: Option<IpAddr>)
where
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
        })
        .inc();

    let notify_receiver = Aggregates::subscribe(&*state.state);
    let (sender, receiver) = stream.split();
    let mut subscriber = Subscriber::new(
        id,
        subscriber_ip,
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
    pub fn new(
        id: SubscriberId,
        ip_addr: Option<IpAddr>,
        state: Arc<S>,
        ws_state: Arc<WsState>,
        notify_receiver: Receiver<AggregationEvent>,
        receiver: SplitStream<WebSocket>,
        sender: SplitSink<WebSocket, Message>,
    ) -> Self {
        Self {
            id,
            ip_addr,
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
                        })
                        .inc();

                    return Err(anyhow!("Subscriber did not respond to ping. Closing connection."));
                }
                self.responded_to_ping = false;
                self.sender.send(Message::Ping(vec![])).await?;
                Ok(())
            },
            _ = tokio::time::sleep_until(self.connection_deadline) => {
                tracing::info!(
                    id = self.id,
                    ip = ?self.ip_addr,
                    "Connection timeout reached (24h). Closing connection.",
                );
                self.sender
                    .send(
                        serde_json::to_string(&ServerMessage::Response(
                            ServerResponseMessage::Err {
                                error: "Connection timeout reached (24h)".to_string(),
                            },
                        ))?
                        .into(),
                    )
                    .await?;
                self.sender.close().await?;
                self.closed = true;
                Ok(())
            },
            _ = self.exit.changed() => {
                self.sender.close().await?;
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
                        })
                        .inc();

                    self.sender
                        .send(
                            serde_json::to_string(&ServerResponseMessage::Err {
                                error: "Rate limit exceeded".to_string(),
                            })?
                            .into(),
                        )
                        .await?;
                    self.sender.close().await?;
                    self.closed = true;
                    return Ok(());
                }
            }

            // `sender.feed` buffers a message to the client but does not flush it, so we can send
            // multiple messages and flush them all at once.
            self.sender.feed(message.into()).await?;

            self.ws_state
                .metrics
                .interactions
                .get_or_create(&Labels {
                    interaction: Interaction::PriceUpdate,
                    status: Status::Success,
                })
                .inc();
        }

        self.sender.flush().await?;
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
                    })
                    .inc();

                // Send the close message to gracefully shut down the connection
                // Otherwise the client might get an abnormal Websocket closure
                // error.
                self.sender.close().await?;
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
                    })
                    .inc();
                self.sender
                    .send(
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
                    self.sender
                        .send(
                            serde_json::to_string(&ServerMessage::Response(
                                ServerResponseMessage::Err {
                                    error: format!(
                                        "Price feed(s) with id(s) {:?} not found",
                                        not_found_price_ids
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
            })
            .inc();

        self.sender
            .send(
                serde_json::to_string(&ServerMessage::Response(ServerResponseMessage::Success))?
                    .into(),
            )
            .await?;

        Ok(())
    }
}
