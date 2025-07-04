use {
    crate::server::{wait_for_exit, State},
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
    tokio::sync::broadcast,
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
    Ping,
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
                self.handle_update(UpdateEvent::Ping).await
            },
            _ = wait_for_exit() => {
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
        let start = std::time::Instant::now();
        let update_name;
        let result = match event.clone() {
            UpdateEvent::NewVaa(vaa) => {
                update_name = "new_vaa";
                self.handle_new_vaa(vaa).await
            }
            UpdateEvent::Ping => {
                update_name = "ping";
                self.sender.send(Message::Ping(vec![].into())).await?;
                Ok(())
            }
        };
        let status = match &result {
            Ok(_) => "success",
            Err(_) => "error",
        };
        let label = [("status", status), ("name", update_name)];
        metrics::counter!("ws_server_update_total", &label).increment(1);
        metrics::histogram!("ws_server_update_duration_seconds", &label,)
            .record(start.elapsed().as_secs_f64());
        result
    }

    async fn handle_client_message(&mut self, message: Message) -> Result<()> {
        let start = std::time::Instant::now();
        let message_type;

        let result: anyhow::Result<()> = match message {
            Message::Close(_) => {
                // Closing the connection. We don't remove it from the subscribers
                // list, instead when the Subscriber struct is dropped the channel
                // to subscribers list will be closed and it will eventually get
                // removed.
                // Send the close message to gracefully shut down the connection
                // Otherwise the client might get an abnormal Websocket closure
                // error.
                message_type = "close";
                self.sender.close().await?;
                self.closed = true;
                Ok(())
            }
            Message::Text(_) => {
                message_type = "text";
                Ok(())
            }
            Message::Binary(_) => {
                message_type = "binary";
                Ok(())
            }
            Message::Ping(_) => {
                message_type = "ping";
                Ok(())
            }
            Message::Pong(_) => {
                message_type = "pong";
                self.responded_to_ping = true;
                Ok(())
            }
        };

        let status = match &result {
            Ok(_) => "success",
            Err(_) => "error",
        };
        let label = [("status", status), ("message_type", message_type)];
        metrics::counter!("ws_client_message_total", &label).increment(1);
        metrics::histogram!("ws_client_message_duration_seconds", &label,)
            .record(start.elapsed().as_secs_f64());

        result
    }
}
