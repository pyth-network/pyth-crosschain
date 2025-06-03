use crate::config::CHANNEL_CAPACITY;
use anyhow::{Result, bail};
use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use http::HeaderValue;
use protobuf::Message;
use pyth_lazer_publisher_sdk::transaction::SignedLazerTransaction;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::{
    select,
    sync::mpsc::{self, Receiver, Sender},
};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async_with_config,
    tungstenite::Message as TungsteniteMessage,
};
use url::Url;

pub struct RelayerSender {
    pub(crate) sender: Sender<SignedLazerTransaction>,
}

impl RelayerSender {
    pub async fn new(url: &Url, token: &str) -> Self {
        let (sender, receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let mut task = RelayerSessionTask {
            url: url.clone(),
            token: token.to_owned(),
            receiver,
        };
        tokio::spawn(async move { task.run().await });
        Self { sender }
    }
}

type RelayerWsSender = SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, TungsteniteMessage>;
type RelayerWsReceiver = SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>;

async fn connect_to_relayer(
    mut url: Url,
    token: &str,
) -> Result<(RelayerWsSender, RelayerWsReceiver)> {
    tracing::info!("connecting to the relayer at {}", url);
    url.set_path("/v1/transaction");
    let mut req = url.clone().into_client_request()?;
    let headers = req.headers_mut();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {token}"))?,
    );
    let (ws_stream, _) = connect_async_with_config(req, None, true).await?;
    Ok(ws_stream.split())
}

struct RelayerWsSession {
    ws_sender: RelayerWsSender,
}

impl RelayerWsSession {
    async fn send_transaction(
        &mut self,
        signed_lazer_transaction: SignedLazerTransaction,
    ) -> Result<()> {
        tracing::debug!(
            "Sending SignedLazerTransaction: {:?}",
            signed_lazer_transaction
        );
        let buf = signed_lazer_transaction.write_to_bytes()?;
        self.ws_sender
            .send(TungsteniteMessage::from(buf.clone()))
            .await?;
        self.ws_sender.flush().await?;
        Ok(())
    }
}

struct RelayerSessionTask {
    // connection state
    url: Url,
    token: String,
    receiver: Receiver<SignedLazerTransaction>,
}

impl RelayerSessionTask {
    pub async fn run(&mut self) {
        let mut failure_count = 0;
        let retry_duration = Duration::from_secs(1);

        loop {
            match self.run_relayer_connection().await {
                Ok(()) => {
                    tracing::info!("relayer session graceful shutdown");
                    return;
                }
                Err(e) => {
                    failure_count += 1;
                    tracing::error!(
                        "relayer session failed with error: {:?}, failure_count: {}; retrying in {:?}",
                        e,
                        failure_count,
                        retry_duration
                    );
                    tokio::time::sleep(retry_duration).await;
                }
            }
        }
    }

    pub async fn run_relayer_connection(&mut self) -> Result<()> {
        // Establish relayer connection
        // Relayer will drop the connection if no data received in 5s
        let (relayer_ws_sender, mut relayer_ws_receiver) =
            connect_to_relayer(self.url.clone(), &self.token).await?;
        let mut relayer_ws_session = RelayerWsSession {
            ws_sender: relayer_ws_sender,
        };

        loop {
            select! {
                Some(transaction) = self.receiver.recv() => {
                    if let Err(e) = relayer_ws_session.send_transaction(transaction).await
                    {
                        tracing::error!("Error publishing transaction to Lazer relayer: {e:?}");
                        bail!("Failed to publish transaction to Lazer relayer: {e:?}");
                    }
                }
                // Handle messages from the relayers, such as errors if we send a bad update
                msg = relayer_ws_receiver.next() => {
                    match msg {
                        Some(Ok(msg)) => {
                            tracing::debug!("Received message from relayer: {msg:?}");
                        }
                        Some(Err(e)) => {
                            tracing::error!("Error receiving message from at relayer: {e:?}");
                        }
                        None => {
                            tracing::error!("relayer connection closed");
                            bail!("relayer connection closed");
                        }
                    }
                }
            }
        }
    }
}
