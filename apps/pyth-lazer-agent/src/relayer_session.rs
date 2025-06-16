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

#[cfg(test)]
mod tests {
    use crate::relayer_session::RelayerSessionTask;
    use ed25519_dalek::{Signer, SigningKey};
    use futures_util::StreamExt;
    use protobuf::well_known_types::timestamp::Timestamp;
    use protobuf::{Message, MessageField};
    use pyth_lazer_publisher_sdk::publisher_update::feed_update::Update;
    use pyth_lazer_publisher_sdk::publisher_update::{FeedUpdate, PriceUpdate, PublisherUpdate};
    use pyth_lazer_publisher_sdk::transaction::lazer_transaction::Payload;
    use pyth_lazer_publisher_sdk::transaction::signature_data::Data::Ed25519;
    use pyth_lazer_publisher_sdk::transaction::{
        Ed25519SignatureData, LazerTransaction, SignatureData, SignedLazerTransaction,
    };
    use std::net::SocketAddr;
    use tokio::net::TcpListener;
    use tokio::sync::{broadcast, mpsc};
    use url::Url;

    pub const RELAYER_CHANNEL_CAPACITY: usize = 1000;

    fn get_private_key() -> SigningKey {
        SigningKey::from_keypair_bytes(&[
            105, 175, 146, 91, 32, 145, 164, 199, 37, 111, 139, 255, 44, 225, 5, 247, 154, 170,
            238, 70, 47, 15, 9, 48, 102, 87, 180, 50, 50, 38, 148, 243, 62, 148, 219, 72, 222, 170,
            8, 246, 176, 33, 205, 29, 118, 11, 220, 163, 214, 204, 46, 49, 132, 94, 170, 173, 244,
            39, 179, 211, 177, 70, 252, 31,
        ])
        .unwrap()
    }

    pub async fn run_mock_relayer(
        addr: SocketAddr,
        back_sender: mpsc::Sender<SignedLazerTransaction>,
    ) {
        let listener = TcpListener::bind(addr).await.unwrap();

        tokio::spawn(async move {
            let Ok((stream, _)) = listener.accept().await else {
                panic!("failed to accept mock relayer websocket connection");
            };
            let ws_stream = tokio_tungstenite::accept_async(stream)
                .await
                .expect("handshake failed");
            let (_, mut read) = ws_stream.split();
            while let Some(msg) = read.next().await {
                if let Ok(msg) = msg {
                    if msg.is_binary() {
                        tracing::info!("Received binary message: {msg:?}");
                        let transaction =
                            SignedLazerTransaction::parse_from_bytes(msg.into_data().as_ref())
                                .unwrap();
                        back_sender.clone().send(transaction).await.unwrap();
                    }
                } else {
                    tracing::error!("Received a malformed message: {msg:?}");
                }
            }
        });
    }

    #[tokio::test]
    async fn test_relayer_session() {
        let (back_sender, mut back_receiver) = mpsc::channel(RELAYER_CHANNEL_CAPACITY);
        let relayer_addr = "127.0.0.1:12346".parse().unwrap();
        run_mock_relayer(relayer_addr, back_sender).await;
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        let (relayer_sender, relayer_receiver) = broadcast::channel(RELAYER_CHANNEL_CAPACITY);

        let mut relayer_session_task = RelayerSessionTask {
            // connection state
            url: Url::parse("ws://127.0.0.1:12346").unwrap(),
            token: "token1".to_string(),
            receiver: relayer_receiver,
        };
        tokio::spawn(async move { relayer_session_task.run().await });
        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

        let transaction = get_signed_lazer_transaction();
        relayer_sender
            .send(transaction.clone())
            .expect("relayer_sender.send failed");
        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        let received_transaction = back_receiver
            .recv()
            .await
            .expect("back_receiver.recv failed");
        assert_eq!(transaction, received_transaction);
    }

    fn get_signed_lazer_transaction() -> SignedLazerTransaction {
        let publisher_update = PublisherUpdate {
            updates: vec![FeedUpdate {
                feed_id: Some(1),
                source_timestamp: MessageField::some(Timestamp::now()),
                update: Some(Update::PriceUpdate(PriceUpdate {
                    price: Some(1_000_000_000i64),
                    ..PriceUpdate::default()
                })),
                special_fields: Default::default(),
            }],
            publisher_timestamp: MessageField::some(Timestamp::now()),
            special_fields: Default::default(),
        };
        let lazer_transaction = LazerTransaction {
            payload: Some(Payload::PublisherUpdate(publisher_update)),
            special_fields: Default::default(),
        };
        let buf = lazer_transaction.write_to_bytes().unwrap();
        let signing_key = get_private_key();
        let signature = signing_key.sign(&buf);
        let signature_data = SignatureData {
            data: Some(Ed25519(Ed25519SignatureData {
                signature: Some(signature.to_bytes().into()),
                public_key: Some(signing_key.verifying_key().to_bytes().into()),
                special_fields: Default::default(),
            })),
            special_fields: Default::default(),
        };
        SignedLazerTransaction {
            signature_data: MessageField::some(signature_data),
            payload: Some(buf),
            special_fields: Default::default(),
        }
    }
}
