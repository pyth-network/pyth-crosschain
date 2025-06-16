use crate::config::{CHANNEL_CAPACITY, Config};
use crate::relayer_session::RelayerSessionTask;
use anyhow::{Context, Result, bail};
use base64::Engine;
use base64::prelude::BASE64_STANDARD;
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
use std::path::PathBuf;
use tokio::sync::broadcast;
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
    fn load_signing_key(publish_keypair_path: &PathBuf) -> Result<SigningKey> {
        // Read the keypair from the file using Solana SDK because it's the same key used by the Pythnet publisher
        let publish_keypair = match read_keypair_file(publish_keypair_path) {
            Ok(k) => k,
            Err(e) => {
                tracing::error!(
                    error = ?e,
                    publish_keypair_path = publish_keypair_path.display().to_string(),
                    "Reading publish keypair returned an error. ",
                );
                bail!("Reading publish keypair returned an error.");
            }
        };

        SigningKey::from_keypair_bytes(&publish_keypair.to_bytes())
            .context("Failed to create signing key from keypair")
    }

    pub async fn new(config: &Config) -> Self {
        let signing_key = match Self::load_signing_key(&config.publish_keypair_path) {
            Ok(signing_key) => signing_key,
            Err(e) => {
                tracing::error!("Failed to load signing key: {e:?}");
                // Can't proceed on key failure
                panic!("Failed to load signing key: {e:?}");
            }
        };

        let (relayer_sender, _) = broadcast::channel(CHANNEL_CAPACITY);
        for url in config.relayer_urls.iter() {
            let mut task = RelayerSessionTask {
                url: url.clone(),
                token: BASE64_STANDARD.encode(signing_key.verifying_key().to_bytes()),
                receiver: relayer_sender.subscribe(),
            };
            tokio::spawn(async move { task.run().await });
        }

        let (sender, receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let mut task = LazerPublisherTask {
            config: config.clone(),
            receiver,
            pending_updates: Vec::new(),
            relayer_sender,
            signing_key,
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
    relayer_sender: broadcast::Sender<SignedLazerTransaction>,
    signing_key: SigningKey,
}

impl LazerPublisherTask {
    pub async fn run(&mut self) {
        let mut publish_interval = interval(self.config.publish_interval_duration);
        loop {
            select! {
                Some(feed_update) = self.receiver.recv() => {
                    self.pending_updates.push(feed_update);
                }
                _ = publish_interval.tick() => {
                    if let Err(err) = self.batch_transaction().await {
                        error!("Failed to publish updates: {}", err);
                    }
                }
            }
        }
    }

    async fn batch_transaction(&mut self) -> Result<()> {
        if self.pending_updates.is_empty() {
            return Ok(());
        }

        let publisher_update = PublisherUpdate {
            updates: self.pending_updates.drain(..).collect(),
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
        let signature = self.signing_key.sign(&buf);
        let signature_data = SignatureData {
            data: Some(Ed25519(Ed25519SignatureData {
                signature: Some(signature.to_bytes().into()),
                public_key: Some(self.signing_key.verifying_key().to_bytes().into()),
                special_fields: Default::default(),
            })),
            special_fields: Default::default(),
        };
        let signed_lazer_transaction = SignedLazerTransaction {
            signature_data: MessageField::some(signature_data),
            payload: Some(buf),
            special_fields: Default::default(),
        };
        match self.relayer_sender.send(signed_lazer_transaction.clone()) {
            Ok(_) => (),
            Err(e) => {
                tracing::error!("Error sending transaction to relayer receivers: {e}");
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::config::{CHANNEL_CAPACITY, Config};
    use crate::lazer_publisher::LazerPublisherTask;
    use ed25519_dalek::SigningKey;
    use protobuf::well_known_types::timestamp::Timestamp;
    use protobuf::{Message, MessageField};
    use pyth_lazer_publisher_sdk::publisher_update::feed_update::Update;
    use pyth_lazer_publisher_sdk::publisher_update::{FeedUpdate, PriceUpdate};
    use pyth_lazer_publisher_sdk::transaction::{LazerTransaction, lazer_transaction};
    use std::io::Write;
    use std::path::PathBuf;
    use std::time::Duration;
    use tempfile::NamedTempFile;
    use tokio::sync::broadcast::error::TryRecvError;
    use tokio::sync::{broadcast, mpsc};
    use url::Url;

    fn get_private_key() -> SigningKey {
        SigningKey::from_keypair_bytes(&[
            105, 175, 146, 91, 32, 145, 164, 199, 37, 111, 139, 255, 44, 225, 5, 247, 154, 170,
            238, 70, 47, 15, 9, 48, 102, 87, 180, 50, 50, 38, 148, 243, 62, 148, 219, 72, 222, 170,
            8, 246, 176, 33, 205, 29, 118, 11, 220, 163, 214, 204, 46, 49, 132, 94, 170, 173, 244,
            39, 179, 211, 177, 70, 252, 31,
        ])
        .unwrap()
    }

    fn get_private_key_file() -> NamedTempFile {
        let private_key_string = "[105,175,146,91,32,145,164,199,37,111,139,255,44,225,5,247,154,170,238,70,47,15,9,48,102,87,180,50,50,38,148,243,62,148,219,72,222,170,8,246,176,33,205,29,118,11,220,163,214,204,46,49,132,94,170,173,244,39,179,211,177,70,252,31]";
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file
            .as_file_mut()
            .write_all(private_key_string.as_bytes())
            .unwrap();
        temp_file.flush().unwrap();
        temp_file
    }

    #[tokio::test]
    async fn test_lazer_exporter_task() {
        let signing_key_file = get_private_key_file();
        let signing_key = get_private_key();

        let config = Config {
            listen_address: "0.0.0.0:12345".parse().unwrap(),
            relayer_urls: vec![Url::parse("http://127.0.0.1:12346").unwrap()],
            publish_keypair_path: PathBuf::from(signing_key_file.path()),
            publish_interval_duration: Duration::from_millis(25),
        };

        let (relayer_sender, mut relayer_receiver) = broadcast::channel(CHANNEL_CAPACITY);
        let (sender, receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let mut task = LazerPublisherTask {
            config: config.clone(),
            receiver,
            pending_updates: Vec::new(),
            relayer_sender,
            signing_key,
        };
        tokio::spawn(async move { task.run().await });

        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        match relayer_receiver.try_recv() {
            Err(TryRecvError::Empty) => (),
            _ => panic!("channel should be empty"),
        }

        let feed_update = FeedUpdate {
            feed_id: Some(1),
            source_timestamp: MessageField::some(Timestamp::now()),
            update: Some(Update::PriceUpdate(PriceUpdate {
                price: Some(100_000 * 100_000_000),
                ..PriceUpdate::default()
            })),
            special_fields: Default::default(),
        };
        sender.send(feed_update.clone()).await.unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        match relayer_receiver.try_recv() {
            Ok(transaction) => {
                let lazer_transaction =
                    LazerTransaction::parse_from_bytes(transaction.payload.unwrap().as_slice())
                        .unwrap();
                let publisher_update =
                    if let lazer_transaction::Payload::PublisherUpdate(publisher_update) =
                        lazer_transaction.payload.unwrap()
                    {
                        publisher_update
                    } else {
                        panic!("expected publisher_update")
                    };
                assert_eq!(publisher_update.updates.len(), 1);
                assert_eq!(publisher_update.updates[0], feed_update);
            }
            _ => panic!("channel should have a transaction waiting"),
        }
    }
}
