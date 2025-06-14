use anyhow::{Result, bail};
use backoff::ExponentialBackoffBuilder;
use backoff::backoff::Backoff;
use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use http::HeaderValue;
use protobuf::Message;
use pyth_lazer_publisher_sdk::transaction::SignedLazerTransaction;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::select;
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async_with_config,
    tungstenite::Message as TungsteniteMessage,
};
use url::Url;

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

pub struct RelayerSessionTask {
    // connection state
    pub url: Url,
    pub token: String,
    pub receiver: broadcast::Receiver<SignedLazerTransaction>,
}

impl RelayerSessionTask {
    pub async fn run(&mut self) {
        let initial_interval = Duration::from_millis(100);
        let max_interval = Duration::from_secs(5);
        let mut backoff = ExponentialBackoffBuilder::new()
            .with_initial_interval(initial_interval)
            .with_max_interval(max_interval)
            .with_max_elapsed_time(None)
            .build();

        const FAILURE_RESET_TIME: Duration = Duration::from_secs(300);
        let mut first_failure_time = Instant::now();
        let mut failure_count = 0;

        loop {
            match self.run_relayer_connection().await {
                Ok(()) => {
                    tracing::info!("relayer session graceful shutdown");
                    return;
                }
                Err(e) => {
                    if first_failure_time.elapsed() > FAILURE_RESET_TIME {
                        failure_count = 0;
                        first_failure_time = Instant::now();
                        backoff.reset();
                    }

                    failure_count += 1;
                    let next_backoff = backoff.next_backoff().unwrap_or(max_interval);
                    tracing::error!(
                        "relayer session failed with error: {:?}, failure_count: {}; retrying in {:?}",
                        e,
                        failure_count,
                        next_backoff
                    );
                    tokio::time::sleep(next_backoff).await;
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
                recv_result = self.receiver.recv() => {
                    match recv_result {
                        Ok(transaction) => {
                            if let Err(e) = relayer_ws_session.send_transaction(transaction).await {
                                tracing::error!("Error publishing transaction to Lazer relayer: {e:?}");
                                bail!("Failed to publish transaction to Lazer relayer: {e:?}");
                            }
                        },
                        Err(e) => {
                            match e {
                                broadcast::error::RecvError::Closed => {
                                    tracing::error!("transaction broadcast channel closed");
                                    bail!("transaction broadcast channel closed");
                                }
                                broadcast::error::RecvError::Lagged(skipped_count) => {
                                    tracing::warn!("transaction broadcast channel lagged by {skipped_count} messages");
                                }
                            }
                        }
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
