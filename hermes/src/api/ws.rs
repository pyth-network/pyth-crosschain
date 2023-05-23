use {
    super::types::{
        PriceIdInput,
        RpcPriceFeed,
    },
    crate::store::{
        types::RequestTime,
        Store,
    },
    anyhow::Result,
    axum::{
        extract::{
            ws::{
                Message,
                WebSocket,
                WebSocketUpgrade,
            },
            State,
        },
        response::IntoResponse,
    },
    dashmap::DashMap,
    futures::{
        future::join_all,
        stream::{
            SplitSink,
            SplitStream,
        },
        SinkExt,
        StreamExt,
    },
    pyth_sdk::PriceIdentifier,
    serde::{
        Deserialize,
        Serialize,
    },
    std::{
        collections::HashMap,
        pin::Pin,
        sync::atomic::{
            AtomicUsize,
            Ordering,
        },
        time::Duration,
    },
    tokio::sync::mpsc,
};

pub const PING_INTERVAL_DURATION: Duration = Duration::from_secs(30);

pub async fn ws_route_handler(
    ws: WebSocketUpgrade,
    State(state): State<super::State>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| websocket_handler(socket, state))
}

async fn websocket_handler(stream: WebSocket, state: super::State) {
    let ws_state = state.ws.clone();
    let id = ws_state.subscriber_counter.fetch_add(1, Ordering::SeqCst);

    let (sender, receiver) = stream.split();

    // TODO: Use a configured value for the buffer size or make it const static
    // TODO: Use redis stream to source the updates instead of a channel
    let (tx, rx) = mpsc::channel::<Vec<PriceIdentifier>>(1000);

    ws_state.subscribers.insert(id, tx);

    log::debug!("New websocket connection, assigning id: {}", id);

    let mut subscriber = Subscriber::new(id, state.store.clone(), rx, receiver, sender);

    subscriber.run().await;
}

pub type SubscriberId = usize;

/// Subscriber is an actor that handles a single websocket connection.
/// It listens to the store for updates and sends them to the client.
pub struct Subscriber {
    id:                      SubscriberId,
    closed:                  bool,
    store:                   Store,
    update_rx:               mpsc::Receiver<Vec<PriceIdentifier>>,
    receiver:                SplitStream<WebSocket>,
    sender:                  SplitSink<WebSocket, Message>,
    price_feeds_with_config: HashMap<PriceIdentifier, PriceFeedClientConfig>,
    ping_interval_future:    Pin<Box<tokio::time::Sleep>>,
    responded_to_ping:       bool,
}

impl Subscriber {
    pub fn new(
        id: SubscriberId,
        store: Store,
        update_rx: mpsc::Receiver<Vec<PriceIdentifier>>,
        receiver: SplitStream<WebSocket>,
        sender: SplitSink<WebSocket, Message>,
    ) -> Self {
        Self {
            id,
            closed: false,
            store,
            update_rx,
            receiver,
            sender,
            price_feeds_with_config: HashMap::new(),
            ping_interval_future: Box::pin(tokio::time::sleep(PING_INTERVAL_DURATION)),
            responded_to_ping: true, // We start with true so we don't close the connection immediately
        }
    }

    pub async fn run(&mut self) {
        while !self.closed {
            if let Err(e) = self.handle_next().await {
                log::error!("Subscriber {}: Error handling next message: {}", self.id, e);
                break;
            }
        }
    }

    async fn handle_next(&mut self) -> Result<()> {
        tokio::select! {
            maybe_update_feed_ids = self.update_rx.recv() => {
                let update_feed_ids = maybe_update_feed_ids.ok_or_else(|| {
                    anyhow::anyhow!("Update channel closed.")
                })?;
                self.handle_price_feeds_update(update_feed_ids).await?;
            },
            maybe_message_or_err = self.receiver.next() => {
                match maybe_message_or_err {
                    None => {
                        log::debug!("Subscriber {} closed connection unexpectedly.", self.id);
                        self.closed = true;
                        return Ok(());
                    },
                    Some(message_or_err) => self.handle_client_message(message_or_err?).await?
                }
            },
            _  = &mut self.ping_interval_future => {
                if !self.responded_to_ping {
                    log::debug!("Subscriber {} did not respond to ping, closing connection.", self.id);
                    self.closed = true;
                    return Ok(());
                }
                self.responded_to_ping = false;
                self.sender.send(Message::Ping(vec![])).await?;
                self.ping_interval_future = Box::pin(tokio::time::sleep(PING_INTERVAL_DURATION));
            }
        }

        Ok(())
    }

    async fn handle_price_feeds_update(
        &mut self,
        price_feed_ids: Vec<PriceIdentifier>,
    ) -> Result<()> {
        for price_feed_id in price_feed_ids {
            if let Some(config) = self.price_feeds_with_config.get(&price_feed_id) {
                let price_feeds_with_update_data = self
                    .store
                    .get_price_feeds_with_update_data(vec![price_feed_id], RequestTime::Latest)?;
                let price_feed = *price_feeds_with_update_data
                    .price_feeds
                    .iter()
                    .find(|price_feed| price_feed.id == price_feed_id.to_bytes())
                    .ok_or_else(|| {
                        anyhow::anyhow!("Price feed {} not found.", price_feed_id.to_string())
                    })?;
                let price_feed = RpcPriceFeed::from_price_feed_message(
                    price_feed,
                    config.verbose,
                    config.binary,
                );
                // Feed does not flush the message and will allow us
                // to send multiple messages in a single flush.
                self.sender
                    .feed(Message::Text(serde_json::to_string(
                        &ServerMessage::PriceUpdate { price_feed },
                    )?))
                    .await?;
            }
        }
        self.sender.flush().await?;
        Ok(())
    }

    async fn handle_client_message(&mut self, message: Message) -> Result<()> {
        if let Message::Close(_) = message {
            log::debug!("Subscriber {} closed connection", self.id);
            self.closed = true;
            return Ok(());
        }

        let maybe_client_message = match message {
            Message::Text(text) => serde_json::from_str::<ClientMessage>(&text),
            Message::Binary(data) => serde_json::from_slice::<ClientMessage>(&data),
            Message::Ping(_) => {
                // Axum will send Pong automatically
                return Ok(());
            }
            Message::Pong(_) => {
                self.responded_to_ping = true;
                return Ok(());
            }
            _ => {
                return Ok(());
            }
        };

        match maybe_client_message {
            Err(e) => {
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
            }) => {
                for id in ids {
                    let price_id: PriceIdentifier = id.into();
                    self.price_feeds_with_config
                        .insert(price_id, PriceFeedClientConfig { verbose, binary });
                }
            }
            Ok(ClientMessage::Unsubscribe { ids }) => {
                for id in ids {
                    let price_id: PriceIdentifier = id.into();
                    self.price_feeds_with_config.remove(&price_id);
                }
            }
        }

        self.sender
            .send(
                serde_json::to_string(&ServerMessage::Response(ServerResponseMessage::Ok))?.into(),
            )
            .await?;

        Ok(())
    }
}

pub async fn dispatch_updates(update_feed_ids: Vec<PriceIdentifier>, state: super::State) {
    let ws_state = state.ws.clone();
    let update_feed_ids_ref = &update_feed_ids;

    let closed_subscribers: Vec<Option<SubscriberId>> = join_all(
        ws_state
            .subscribers
            .iter_mut()
            .map(|subscriber| async move {
                match subscriber.send(update_feed_ids_ref.clone()).await {
                    Ok(_) => None,
                    Err(e) => {
                        log::debug!("Error sending update to subscriber: {}", e);
                        Some(*subscriber.key())
                    }
                }
            }),
    )
    .await;

    // Remove closed_subscribers from ws_state
    closed_subscribers.into_iter().for_each(|id| {
        if let Some(id) = id {
            ws_state.subscribers.remove(&id);
        }
    });
}

#[derive(Clone)]
pub struct PriceFeedClientConfig {
    verbose: bool,
    binary:  bool,
}

pub struct WsState {
    pub subscriber_counter: AtomicUsize,
    pub subscribers:        DashMap<SubscriberId, mpsc::Sender<Vec<PriceIdentifier>>>,
}

impl WsState {
    pub fn new() -> Self {
        Self {
            subscriber_counter: AtomicUsize::new(0),
            subscribers:        DashMap::new(),
        }
    }
}


#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "subscribe")]
    Subscribe {
        ids:     Vec<PriceIdInput>,
        #[serde(default)]
        verbose: bool,
        #[serde(default)]
        binary:  bool,
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
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "error")]
    Err { error: String },
}
