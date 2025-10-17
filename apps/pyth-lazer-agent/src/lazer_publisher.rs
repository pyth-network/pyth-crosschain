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
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use tokio::sync::broadcast;
use tokio::{
    select,
    sync::mpsc::{self, Receiver, Sender},
    time::interval,
};
use tracing::error;
use ttl_cache::TtlCache;

const DEDUP_CACHE_SIZE: usize = 100_000;

#[derive(Clone, Debug)]
pub struct LazerPublisher {
    sender: Sender<FeedUpdate>,
    pub(crate) is_ready: Arc<AtomicBool>,
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

    #[allow(clippy::panic, reason = "can't run agent without keypair")]
    pub async fn new(config: &Config) -> Self {
        let signing_key = match Self::load_signing_key(&config.publish_keypair_path) {
            Ok(signing_key) => signing_key,
            Err(e) => {
                tracing::error!("Failed to load signing key: {e:?}");
                panic!("Failed to load signing key: {e:?}");
            }
        };

        let authorization_token =
            if let Some(authorization_token) = config.authorization_token.clone() {
                // If authorization_token is configured, use it.
                authorization_token.0
            } else {
                // Otherwise, use the base64 pubkey.
                BASE64_STANDARD.encode(signing_key.verifying_key().to_bytes())
            };

        let (relayer_sender, _) = broadcast::channel(CHANNEL_CAPACITY);
        let is_ready = Arc::new(AtomicBool::new(false));
        for url in config.relayer_urls.iter() {
            let mut task = RelayerSessionTask {
                url: url.clone(),
                token: authorization_token.clone(),
                receiver: relayer_sender.subscribe(),
                is_ready: is_ready.clone(),
                proxy_url: config.proxy_url.clone(),
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
            ttl_cache: TtlCache::new(DEDUP_CACHE_SIZE),
        };
        tokio::spawn(async move { task.run().await });
        Self {
            sender,
            is_ready: is_ready.clone(),
        }
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
    ttl_cache: TtlCache<u32, FeedUpdate>,
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

        let mut updates: Vec<FeedUpdate> = self.pending_updates.drain(..).collect();
        updates.sort_by_key(|u| u.source_timestamp.as_ref().map(|t| (t.seconds, t.nanos)));
        if self.config.enable_update_deduplication {
            updates = deduplicate_feed_updates_in_tx(&updates)?;
            deduplicate_feed_updates(
                &mut updates,
                &mut self.ttl_cache,
                self.config.update_deduplication_ttl,
            );
        }

        if updates.is_empty() {
            return Ok(());
        }

        let publisher_update = PublisherUpdate {
            updates,
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

/// For each feed, keep the latest data. Among updates with the same data, keep the one with the earliest timestamp.
/// Assumes the input is sorted by timestamp ascending.
fn deduplicate_feed_updates_in_tx(
    sorted_feed_updates: &Vec<FeedUpdate>,
) -> Result<Vec<FeedUpdate>> {
    let mut deduped_feed_updates = HashMap::new();
    for update in sorted_feed_updates {
        let entry = deduped_feed_updates.entry(update.feed_id).or_insert(update);
        if entry.update != update.update {
            *entry = update;
        }
    }
    Ok(deduped_feed_updates.into_values().cloned().collect())
}

fn deduplicate_feed_updates(
    sorted_feed_updates: &mut Vec<FeedUpdate>,
    ttl_cache: &mut TtlCache<u32, FeedUpdate>,
    ttl: std::time::Duration,
) {
    sorted_feed_updates.retain(|update| {
        let feed_id = match update.feed_id {
            Some(id) => id,
            None => return false, // drop updates without feed_id
        };

        if let Some(cached_feed) = ttl_cache.get(&feed_id) {
            if cached_feed.update == update.update {
                // drop if the same update is already in the cache
                return false;
            }
        }

        ttl_cache.insert(feed_id, update.clone(), ttl);
        true
    });
}

#[cfg(test)]
mod tests {
    use crate::config::{CHANNEL_CAPACITY, Config};
    use crate::lazer_publisher::{
        DEDUP_CACHE_SIZE, LazerPublisherTask, deduplicate_feed_updates_in_tx,
    };
    use ed25519_dalek::SigningKey;
    use protobuf::well_known_types::timestamp::Timestamp;
    use protobuf::{Message, MessageField};
    use pyth_lazer_protocol::time::TimestampUs;
    use pyth_lazer_publisher_sdk::publisher_update::feed_update::Update;
    use pyth_lazer_publisher_sdk::publisher_update::{FeedUpdate, PriceUpdate};
    use pyth_lazer_publisher_sdk::transaction::{LazerTransaction, lazer_transaction};
    use std::io::Write;
    use std::path::PathBuf;
    use std::time::Duration;
    use tempfile::NamedTempFile;
    use tokio::sync::broadcast::error::TryRecvError;
    use tokio::sync::{broadcast, mpsc};
    use ttl_cache::TtlCache;
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

    fn test_feed_update(feed_id: u32, timestamp: TimestampUs, price: i64) -> FeedUpdate {
        FeedUpdate {
            feed_id: Some(feed_id),
            source_timestamp: MessageField::some(timestamp.into()),
            update: Some(Update::PriceUpdate(PriceUpdate {
                price: Some(price),
                ..PriceUpdate::default()
            })),
            special_fields: Default::default(),
        }
    }

    #[tokio::test]
    async fn test_lazer_exporter_task() {
        let signing_key_file = get_private_key_file();
        let signing_key = get_private_key();

        let config = Config {
            listen_address: "0.0.0.0:12345".parse().unwrap(),
            relayer_urls: vec![Url::parse("http://127.0.0.1:12346").unwrap()],
            authorization_token: None,
            publish_keypair_path: PathBuf::from(signing_key_file.path()),
            publish_interval_duration: Duration::from_millis(25),
            history_service_url: None,
            enable_update_deduplication: false,
            update_deduplication_ttl: Default::default(),
            proxy_url: None,
        };

        let (relayer_sender, mut relayer_receiver) = broadcast::channel(CHANNEL_CAPACITY);
        let (sender, receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let mut task = LazerPublisherTask {
            config: config.clone(),
            receiver,
            pending_updates: Vec::new(),
            relayer_sender,
            signing_key,
            ttl_cache: TtlCache::new(DEDUP_CACHE_SIZE),
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

    #[test]
    fn test_deduplicate_feed_updates() {
        // let's consider a batch containing updates for a single feed. the updates are (ts, price):
        //   - (1, 10)
        //   - (2, 10)
        //   - (3, 10)
        //   - (4, 15)
        //   - (5, 15)
        //   - (6, 10)
        //   - (7, 10)
        // we should only return (6, 10)

        let updates = &vec![
            test_feed_update(1, TimestampUs::from_millis(1).unwrap(), 10),
            test_feed_update(1, TimestampUs::from_millis(2).unwrap(), 10),
            test_feed_update(1, TimestampUs::from_millis(3).unwrap(), 10),
            test_feed_update(1, TimestampUs::from_millis(4).unwrap(), 15),
            test_feed_update(1, TimestampUs::from_millis(5).unwrap(), 15),
            test_feed_update(1, TimestampUs::from_millis(6).unwrap(), 10),
            test_feed_update(1, TimestampUs::from_millis(7).unwrap(), 10),
        ];

        let expected_updates = vec![test_feed_update(
            1,
            TimestampUs::from_millis(6).unwrap(),
            10,
        )];

        let deduped_updates = deduplicate_feed_updates_in_tx(updates).unwrap();
        assert_eq!(deduped_updates, expected_updates);
    }

    #[test]
    fn test_deduplicate_feed_updates_multiple_feeds() {
        let updates = &mut vec![
            test_feed_update(1, TimestampUs::from_millis(1).unwrap(), 10),
            test_feed_update(1, TimestampUs::from_millis(2).unwrap(), 10),
            test_feed_update(1, TimestampUs::from_millis(3).unwrap(), 10),
            test_feed_update(2, TimestampUs::from_millis(4).unwrap(), 15),
            test_feed_update(2, TimestampUs::from_millis(5).unwrap(), 15),
            test_feed_update(2, TimestampUs::from_millis(6).unwrap(), 10),
        ];

        let expected_updates = vec![
            test_feed_update(1, TimestampUs::from_millis(1).unwrap(), 10),
            test_feed_update(2, TimestampUs::from_millis(6).unwrap(), 10),
        ];

        let mut deduped_updates = deduplicate_feed_updates_in_tx(updates).unwrap();
        deduped_updates.sort_by_key(|u| u.feed_id);
        assert_eq!(deduped_updates, expected_updates);
    }

    #[test]
    fn test_deduplicate_feed_updates_multiple_feeds_random_order() {
        let updates = &mut vec![
            test_feed_update(1, TimestampUs::from_millis(1).unwrap(), 10),
            test_feed_update(1, TimestampUs::from_millis(2).unwrap(), 20),
            test_feed_update(1, TimestampUs::from_millis(3).unwrap(), 10),
            test_feed_update(2, TimestampUs::from_millis(4).unwrap(), 15),
            test_feed_update(2, TimestampUs::from_millis(5).unwrap(), 15),
            test_feed_update(2, TimestampUs::from_millis(6).unwrap(), 10),
            test_feed_update(1, TimestampUs::from_millis(7).unwrap(), 20),
            test_feed_update(1, TimestampUs::from_millis(8).unwrap(), 10), // last distinct update for feed 1
            test_feed_update(1, TimestampUs::from_millis(9).unwrap(), 10),
            test_feed_update(2, TimestampUs::from_millis(10).unwrap(), 15),
            test_feed_update(2, TimestampUs::from_millis(11).unwrap(), 15),
            test_feed_update(2, TimestampUs::from_millis(12).unwrap(), 10), // last distinct update for feed 2
        ];

        let expected_updates = vec![
            test_feed_update(1, TimestampUs::from_millis(8).unwrap(), 10),
            test_feed_update(2, TimestampUs::from_millis(12).unwrap(), 10),
        ];

        let mut deduped_updates = deduplicate_feed_updates_in_tx(updates).unwrap();
        deduped_updates.sort_by_key(|u| u.feed_id);
        assert_eq!(deduped_updates, expected_updates);
    }
}
