use {
    crate::server::{State, EXIT},
    anyhow::{anyhow, Result},
    axum::{
        extract::{
            ws::{Message, WebSocket},
            WebSocketUpgrade,
        },
        response::IntoResponse,
    },
    futures::{
        stream::{SplitSink, SplitStream},
        SinkExt, StreamExt,
    },
    std::{
        sync::atomic::{AtomicUsize, Ordering},
        time::Duration,
    },
    tokio::sync::{broadcast, watch},
};

pub struct WsState {
    subscriber_counter: AtomicUsize,
    pub broadcast_sender: broadcast::Sender<UpdateEvent>,
    pub broadcast_receiver: broadcast::Receiver<UpdateEvent>,
}

impl WsState {
    pub fn new(broadcast_channel_size: usize) -> Self {
        let (broadcast_sender, broadcast_receiver) = broadcast::channel(broadcast_channel_size);
        Self {
            subscriber_counter: AtomicUsize::new(0),
            broadcast_sender,
            broadcast_receiver,
        }
    }
}

pub async fn ws_route_handler(
    ws: WebSocketUpgrade,
    state: axum::extract::State<State>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| websocket_handler(state, socket))
}

async fn websocket_handler(state: axum::extract::State<State>, stream: WebSocket) {
    let subscriber_id = state.ws.subscriber_counter.fetch_add(1, Ordering::SeqCst);
    let (sender, receiver) = stream.split();
    let new_receiver = state.ws.broadcast_receiver.resubscribe();
    let mut subscriber = Subscriber::new(subscriber_id, new_receiver, receiver, sender);
    subscriber.run().await;
}

#[derive(Clone, PartialEq, Debug)]
pub enum UpdateEvent {
    NewVaa(Vec<u8>),
}

pub type SubscriberId = usize;

/// Subscriber is an actor that handles a single websocket connection.
/// It listens to the state for updates and sends them to the client.
pub struct Subscriber {
    id: SubscriberId,
    closed: bool,
    notify_receiver: broadcast::Receiver<UpdateEvent>,
    receiver: SplitStream<WebSocket>,
    sender: SplitSink<WebSocket, Message>,
    ping_interval: tokio::time::Interval,
    responded_to_ping: bool,
    exit: watch::Receiver<bool>,
}

const PING_INTERVAL_DURATION: Duration = Duration::from_secs(30);

impl Subscriber {
    pub fn new(
        id: SubscriberId,
        notify_receiver: broadcast::Receiver<UpdateEvent>,
        receiver: SplitStream<WebSocket>,
        sender: SplitSink<WebSocket, Message>,
    ) -> Self {
        Self {
            id,
            closed: false,
            notify_receiver,
            receiver,
            sender,
            ping_interval: tokio::time::interval(PING_INTERVAL_DURATION),
            responded_to_ping: true, // We start with true so we don't close the connection immediately
            exit: EXIT.subscribe(),
        }
    }

    pub async fn run(&mut self) {
        while !self.closed {
            if let Err(e) = self.handle_next().await {
                tracing::warn!(subscriber = self.id, error = ?e, "Error Handling Subscriber Message.");
                break;
            }
        }
    }

    async fn handle_next(&mut self) -> Result<()> {
        tokio::select! {
            maybe_update_event = self.notify_receiver.recv() => {
                match maybe_update_event {
                    Ok(event) => self.handle_update(event).await,
                    Err(e) => Err(anyhow!("Error receiving update event: {:?}", e)),
                }
            },
            maybe_message_or_err = self.receiver.next() => {
                self.handle_client_message(
                    maybe_message_or_err.ok_or(anyhow!("Client channel is closed"))??
                ).await
            },
            _  = self.ping_interval.tick() => {
                if !self.responded_to_ping {
                    return Err(anyhow!("Subscriber did not respond to ping. Closing connection."));
                }
                self.responded_to_ping = false;
                self.sender.send(Message::Ping(vec![].into())).await?;
                Ok(())
            },
            _ = self.exit.changed() => {
                self.sender.close().await?;
                self.closed = true;
                Err(anyhow!("Application is shutting down. Closing connection."))
            }
        }
    }

    async fn handle_new_vaa(&mut self, vaa: Vec<u8>) -> Result<()> {
        self.sender.send(vaa.into()).await?;
        Ok(())
    }

    async fn handle_update(&mut self, event: UpdateEvent) -> Result<()> {
        match event.clone() {
            UpdateEvent::NewVaa(vaa) => self.handle_new_vaa(vaa).await,
        }
    }

    async fn handle_client_message(&mut self, message: Message) -> Result<()> {
        match message {
            Message::Close(_) => {
                // Closing the connection. We don't remove it from the subscribers
                // list, instead when the Subscriber struct is dropped the channel
                // to subscribers list will be closed and it will eventually get
                // removed.
                // Send the close message to gracefully shut down the connection
                // Otherwise the client might get an abnormal Websocket closure
                // error.
                self.sender.close().await?;
                self.closed = true;
                return Ok(());
            }
            Message::Text(_) => {}
            Message::Binary(_) => {}
            Message::Ping(_) => {}
            Message::Pong(_) => self.responded_to_ping = true,
        };
        Ok(())
    }
}
