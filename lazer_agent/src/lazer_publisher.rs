use crate::config::{CHANNEL_CAPACITY, Config};
use anyhow::{Context, Result, bail};
use ed25519_dalek::{Signer, SigningKey};
use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use http::HeaderValue;
use protobuf::well_known_types::timestamp::Timestamp;
use protobuf::{Message, MessageField};
use pyth_lazer_publisher_sdk::publisher_update::{FeedUpdate, PublisherUpdate};
use pyth_lazer_publisher_sdk::transaction::lazer_transaction::Payload;
use pyth_lazer_publisher_sdk::transaction::signature_data::Data::Ed25519;
use pyth_lazer_publisher_sdk::transaction::{
    Ed25519SignatureData, LazerTransaction, SignatureData, SignedLazerTransaction,
};
use solana_keypair::read_keypair_file;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::{
    select,
    sync::mpsc::{self, Receiver, Sender},
    time::interval,
};
use tokio_stream::StreamMap;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async_with_config,
    tungstenite::Message as TungsteniteMessage,
};
use tracing::{error, instrument};
use url::Url;

struct RelayerSender {
    ws_senders: Vec<SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, TungsteniteMessage>>,
}

impl RelayerSender {
    async fn send_price_update(
        &mut self,
        signed_lazer_transaction: &SignedLazerTransaction,
    ) -> Result<()> {
        tracing::debug!("price_update: {:?}", signed_lazer_transaction);
        let buf = signed_lazer_transaction.write_to_bytes()?;
        for sender in self.ws_senders.iter_mut() {
            sender.send(TungsteniteMessage::from(buf.clone())).await?;
            sender.flush().await?;
        }
        Ok(())
    }
}

async fn connect_to_relayer(
    mut url: Url,
    token: &str,
) -> Result<(
    SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, TungsteniteMessage>,
    SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>,
)> {
    tracing::info!("connecting to the relayer at {}", url);
    url.set_path("/v1/transaction");
    let mut req = url.clone().into_client_request()?;
    let headers = req.headers_mut();
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", token))?,
    );
    let (ws_stream, _) = connect_async_with_config(req, None, true).await?;
    Ok(ws_stream.split())
}

async fn connect_to_relayers(
    config: &Config,
) -> Result<(
    RelayerSender,
    Vec<SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
)> {
    let mut relayer_senders = Vec::new();
    let mut relayer_receivers = Vec::new();
    for url in config.relayer_urls.clone() {
        let (relayer_sender, relayer_receiver) =
            connect_to_relayer(url, &config.authorization_token).await?;
        relayer_senders.push(relayer_sender);
        relayer_receivers.push(relayer_receiver);
    }
    let sender = RelayerSender {
        ws_senders: relayer_senders,
    };
    tracing::info!("connected to relayers: {:?}", config.relayer_urls);
    Ok((sender, relayer_receivers))
}

#[derive(Debug, Clone)]
pub struct LazerPublisher {
    sender: Sender<FeedUpdate>,
}

impl LazerPublisher {
    pub async fn new(config: &Config) -> Self {
        let (sender, receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let mut task = LazerPublisherTask {
            config: config.clone(),
            receiver,
            pending_updates: Vec::new(),
        };
        tokio::spawn(async move { task.run().await });
        Self { sender }
    }

    pub async fn push_feed_update(&self, feed_update: FeedUpdate) -> Result<()> {
        self.sender.send(feed_update).await?;
        Ok(())
    }
}

struct LazerPublisherTask {
    // connection state
    config: Config,
    receiver: Receiver<FeedUpdate>,
    pending_updates: Vec<FeedUpdate>,
}

impl LazerPublisherTask {
    pub async fn run(&mut self) {
        let mut failure_count = 0;
        let retry_duration = Duration::from_secs(1);

        loop {
            match self.run_relayer_connection().await {
                Ok(()) => {
                    tracing::info!("lazer_publisher graceful shutdown");
                    return;
                }
                Err(e) => {
                    failure_count += 1;
                    tracing::error!(
                        "lazer_publisher failed with error: {:?}, failure_count: {}; retrying in {:?}",
                        e,
                        failure_count,
                        retry_duration
                    );
                    tokio::time::sleep(retry_duration).await;
                }
            }
        }
    }

    #[instrument(skip(self), fields(component = "lazer_publisher"))]
    pub async fn run_relayer_connection(&mut self) -> Result<()> {
        // Establish relayer connections
        // Relayer will drop the connection if no data received in 5s
        let (mut relayer_sender, relayer_receivers) = connect_to_relayers(&self.config).await?;
        let mut stream_map = StreamMap::new();
        for (i, receiver) in relayer_receivers.into_iter().enumerate() {
            stream_map.insert(self.config.relayer_urls[i].clone(), receiver);
        }

        // Read the keypair from the file using Solana SDK because it's the same key used by the Pythnet publisher
        let publish_keypair = match read_keypair_file(&self.config.publish_keypair_path) {
            Ok(k) => k,
            Err(e) => {
                tracing::error!(
                    error = ?e,
                    publish_keypair_path = self.config.publish_keypair_path.display().to_string(),
                    "Reading publish keypair returned an error. ",
                );
                bail!("Reading publish keypair returned an error. ");
            }
        };

        let signing_key = SigningKey::from_keypair_bytes(&publish_keypair.to_bytes())
            .context("Failed to create signing key from keypair")?;

        let mut publish_interval = interval(self.config.publish_interval_duration);
        loop {
            select! {
                Some(feed_update) = self.receiver.recv() => {
                    self.pending_updates.push(feed_update);
                }
                _ = publish_interval.tick() => {
                    if let Err(err) = self.publish(&signing_key, &mut relayer_sender).await {
                        error!("Failed to publish updates: {}", err);
                    }
                }
                // Handle messages from the relayers, such as errors if we send a bad update
                mapped_msg = stream_map.next() => {
                    match mapped_msg {
                        Some((relayer_url, Ok(msg))) => {
                            tracing::debug!("Received message from relayer at {relayer_url}: {msg:?}");
                        }
                        Some((relayer_url, Err(e))) => {
                            tracing::error!("Error receiving message from at relayer {relayer_url}: {e:?}");
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

    async fn publish(
        &mut self,
        signing_key: &SigningKey,
        relayer_sender: &mut RelayerSender,
    ) -> Result<()> {
        if self.pending_updates.is_empty() {
            return Ok(());
        }

        let publisher_update = PublisherUpdate {
            updates: self.pending_updates.clone(),
            publisher_timestamp: MessageField::some(Timestamp::now()),
            special_fields: Default::default(),
        };
        let lazer_transaction = LazerTransaction {
            payload: Some(Payload::PublisherUpdate(publisher_update)),
            special_fields: Default::default(),
        };
        let buf = match lazer_transaction.write_to_bytes() {
            Ok(buf) => buf,
            Err(e) => {
                tracing::warn!("Failed to encode Lazer transaction to bytes: {:?}", e);
                bail!("Failed to encode Lazer transaction")
            }
        };
        let signature = signing_key.sign(&buf);
        let signature_data = SignatureData {
            data: Some(Ed25519(Ed25519SignatureData {
                signature: Some(signature.to_bytes().into()),
                public_key: Some(signing_key.verifying_key().to_bytes().into()),
                special_fields: Default::default(),
            })),
            special_fields: Default::default(),
        };
        let signed_lazer_transaction = SignedLazerTransaction {
            signature_data: MessageField::some(signature_data),
            payload: Some(buf),
            special_fields: Default::default(),
        };
        if let Err(e) = relayer_sender
            .send_price_update(&signed_lazer_transaction)
            .await
        {
            tracing::error!("Error publishing update to Lazer relayer: {e:?}");
            bail!("Failed to publish update to Lazer relayer: {e:?}");
        }

        self.pending_updates.clear();
        Ok(())
    }
}
