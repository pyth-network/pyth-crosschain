use crate::config::{CHANNEL_CAPACITY, Config};
use crate::relayer_session::RelayerSender;
use anyhow::{Context, Result, bail};
use ed25519_dalek::{Signer, SigningKey};
use protobuf::well_known_types::timestamp::Timestamp;
use protobuf::{Message, MessageField};
use pyth_lazer_publisher_sdk::publisher_update::{FeedUpdate, PublisherUpdate};
use pyth_lazer_publisher_sdk::transaction::lazer_transaction::Payload;
use pyth_lazer_publisher_sdk::transaction::signature_data::Data::Ed25519;
use pyth_lazer_publisher_sdk::transaction::{
    Ed25519SignatureData, LazerTransaction, SignatureData, SignedLazerTransaction,
};
use solana_keypair::read_keypair_file;
use tokio::{
    select,
    sync::mpsc::{self, Receiver, Sender},
    time::interval,
};
use tracing::error;

#[derive(Clone)]
pub struct LazerPublisher {
    sender: Sender<FeedUpdate>,
}

impl LazerPublisher {
    pub async fn new(config: &Config) -> Self {
        let relayer_senders = futures::future::join_all(
            config
                .relayer_urls
                .iter()
                .map(async |url| RelayerSender::new(url, &config.authorization_token).await),
        )
        .await;

        let (sender, receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let mut task = LazerPublisherTask {
            config: config.clone(),
            receiver,
            pending_updates: Vec::new(),
            relayer_senders,
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
    relayer_senders: Vec<RelayerSender>,
}

impl LazerPublisherTask {
    fn load_signing_key(&self) -> Result<SigningKey> {
        // Read the keypair from the file using Solana SDK because it's the same key used by the Pythnet publisher
        let publish_keypair = match read_keypair_file(&self.config.publish_keypair_path) {
            Ok(k) => k,
            Err(e) => {
                tracing::error!(
                    error = ?e,
                    publish_keypair_path = self.config.publish_keypair_path.display().to_string(),
                    "Reading publish keypair returned an error. ",
                );
                bail!("Reading publish keypair returned an error.");
            }
        };

        SigningKey::from_keypair_bytes(&publish_keypair.to_bytes())
            .context("Failed to create signing key from keypair")
    }

    pub async fn run(&mut self) {
        let signing_key = match self.load_signing_key() {
            Ok(signing_key) => signing_key,
            Err(e) => {
                tracing::error!("Failed to load signing key: {e:?}");
                // Can't proceed on key failure
                panic!("Failed to load signing key: {e:?}");
            }
        };

        let mut publish_interval = interval(self.config.publish_interval_duration);
        loop {
            select! {
                Some(feed_update) = self.receiver.recv() => {
                    self.pending_updates.push(feed_update);
                }
                _ = publish_interval.tick() => {
                    if let Err(err) = self.batch_transaction(&signing_key).await {
                        error!("Failed to publish updates: {}", err);
                    }
                }
            }
        }
    }

    async fn batch_transaction(&mut self, signing_key: &SigningKey) -> Result<()> {
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
        futures::future::join_all(
            self.relayer_senders
                .iter_mut()
                .map(|relayer_sender| relayer_sender.sender.send(signed_lazer_transaction.clone())),
        )
        .await;

        self.pending_updates.clear();
        Ok(())
    }
}
