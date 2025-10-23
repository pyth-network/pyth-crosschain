use anyhow::{Context, Result, bail};
use backoff::ExponentialBackoffBuilder;
use backoff::backoff::Backoff;
use base64::Engine;
use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use http::HeaderValue;
use protobuf::Message;
use pyth_lazer_publisher_sdk::transaction::SignedLazerTransaction;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::select;
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, client_async, connect_async_with_config,
    tungstenite::Message as TungsteniteMessage,
};
use url::Url;

type RelayerWsSender = SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, TungsteniteMessage>;
type RelayerWsReceiver = SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>;

async fn connect_through_proxy(
    proxy_url: &Url,
    target_url: &Url,
    token: &str,
) -> Result<(RelayerWsSender, RelayerWsReceiver)> {
    tracing::info!(
        "connecting to the relayer at {} via proxy {}",
        target_url,
        proxy_url
    );

    let proxy_host = proxy_url.host_str().context("Proxy URL must have a host")?;
    let proxy_port = proxy_url
        .port()
        .unwrap_or(if proxy_url.scheme() == "https" {
            443
        } else {
            80
        });

    let proxy_addr = format!("{proxy_host}:{proxy_port}");
    let mut stream = TcpStream::connect(&proxy_addr)
        .await
        .context(format!("Failed to connect to proxy at {proxy_addr}"))?;

    let target_host = target_url
        .host_str()
        .context("Target URL must have a host")?;
    let target_port = target_url
        .port()
        .unwrap_or(if target_url.scheme() == "wss" {
            443
        } else {
            80
        });

    let target_authority = format!("{target_host}:{target_port}");
    let mut request_parts = vec![format!("CONNECT {target_authority} HTTP/1.1")];
    request_parts.push(format!("Host: {target_authority}"));

    let username = proxy_url.username();
    if !username.is_empty() {
        let password = proxy_url.password().unwrap_or("");
        let credentials = format!("{username}:{password}");
        let encoded = base64::engine::general_purpose::STANDARD.encode(credentials.as_bytes());
        request_parts.push(format!("Proxy-Authorization: Basic {encoded}"));
    }

    request_parts.push("Proxy-Connection: Keep-Alive".to_string());
    request_parts.push(String::new()); // Empty line to end headers
    request_parts.push(String::new()); // CRLF to end request

    let connect_request = request_parts.join("\r\n");

    stream
        .write_all(connect_request.as_bytes())
        .await
        .context(format!(
            "Failed to send CONNECT request to proxy at {proxy_url}"
        ))?;

    let mut response_buffer = Vec::new();
    let mut temp_buf = [0u8; 1024];
    let mut headers_complete = false;

    while !headers_complete {
        let n = stream.read(&mut temp_buf).await.context(format!(
            "Failed to read CONNECT response from proxy at {proxy_url}"
        ))?;

        if n == 0 {
            bail!("Proxy closed connection before sending complete response");
        }

        response_buffer.extend_from_slice(temp_buf.get(..n).context("Invalid buffer slice")?);

        if response_buffer.windows(4).any(|w| w == b"\r\n\r\n") {
            headers_complete = true;
        }
    }

    let response_str = String::from_utf8_lossy(&response_buffer);

    let status_line = response_str
        .lines()
        .next()
        .context("Empty response from proxy")?;

    let parts: Vec<&str> = status_line.split_whitespace().collect();
    if parts.len() < 2 {
        bail!(
            "Invalid HTTP response from proxy at {}: {}",
            proxy_url,
            status_line
        );
    }

    let status_code = parts
        .get(1)
        .context("Missing status code in proxy response")?
        .parse::<u16>()
        .context("Invalid status code in proxy response")?;

    if status_code != 200 {
        let status_text = parts
            .get(2..)
            .map(|s| s.join(" "))
            .unwrap_or_else(|| "Unknown".to_string());
        bail!(
            "Proxy CONNECT failed with status {} {}: {}",
            status_code,
            status_text,
            status_line
        );
    }

    tracing::info!("Successfully connected through proxy at {}", proxy_url);

    let mut req = target_url.clone().into_client_request()?;
    let headers = req.headers_mut();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {token}"))?,
    );

    let maybe_tls_stream = if target_url.scheme() == "wss" {
        let tls_connector = tokio_native_tls::native_tls::TlsConnector::builder()
            .build()
            .context("Failed to build TLS connector")?;
        let tokio_connector = tokio_native_tls::TlsConnector::from(tls_connector);
        let domain = target_host;
        let tls_stream = tokio_connector
            .connect(domain, stream)
            .await
            .context("Failed to establish TLS connection")?;

        MaybeTlsStream::NativeTls(tls_stream)
    } else {
        MaybeTlsStream::Plain(stream)
    };

    let (ws_stream, _) = client_async(req, maybe_tls_stream)
        .await
        .context("Failed to complete WebSocket handshake")?;

    tracing::info!(
        "WebSocket connection established to relayer at {} via proxy {}",
        target_url,
        proxy_url
    );
    Ok(ws_stream.split())
}

async fn connect_to_relayer(
    url: Url,
    token: &str,
    proxy_url: Option<&Url>,
) -> Result<(RelayerWsSender, RelayerWsReceiver)> {
    if let Some(proxy) = proxy_url {
        connect_through_proxy(proxy, &url, token).await
    } else {
        tracing::info!("connecting to the relayer at {}", url);
        let mut req = url.clone().into_client_request()?;
        let headers = req.headers_mut();
        headers.insert(
            "Authorization",
            HeaderValue::from_str(&format!("Bearer {token}"))?,
        );
        let (ws_stream, _) = connect_async_with_config(req, None, true).await?;
        tracing::info!("connected to the relayer at {}", url);
        Ok(ws_stream.split())
    }
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
    pub url: Url,
    pub token: String,
    pub receiver: broadcast::Receiver<SignedLazerTransaction>,
    pub is_ready: Arc<AtomicBool>,
    pub proxy_url: Option<Url>,
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
                    tracing::warn!(
                        "relayer session url: {} ended with error: {:?}, failure_count: {}; retrying in {:?}",
                        self.url,
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
        let (relayer_ws_sender, mut relayer_ws_receiver) =
            connect_to_relayer(self.url.clone(), &self.token, self.proxy_url.as_ref()).await?;
        let mut relayer_ws_session = RelayerWsSession {
            ws_sender: relayer_ws_sender,
        };

        // If we have at least one successful connection, mark as ready.
        self.is_ready.store(true, Ordering::Relaxed);

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
                            tracing::debug!("Received a message from relayer: {msg:?}");
                        }
                        Some(Err(e)) => {
                            tracing::error!("Error receiving message from at relayer: {e:?}");
                        }
                        None => {
                            tracing::warn!("relayer connection closed url: {}", self.url);
                            bail!("relayer connection closed");
                        }
                    }
                }
            }
        }
    }
}

//noinspection DuplicatedCode
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
    use std::sync::Arc;
    use std::sync::atomic::AtomicBool;
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
                        tracing::info!("Received a binary message: {msg:?}");
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
            url: Url::parse("ws://127.0.0.1:12346").unwrap(),
            token: "token1".to_string(),
            receiver: relayer_receiver,
            is_ready: Arc::new(AtomicBool::new(false)),
            proxy_url: None,
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
