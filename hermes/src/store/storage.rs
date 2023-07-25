use {
    super::{
        proof::wormhole_merkle::WormholeMerkleState,
        types::{
            AccumulatorMessages,
            ProofSet,
            RawMessage,
            RequestTime,
            Slot,
            UnixTimestamp,
        },
    },
    anyhow::{
        anyhow,
        Result,
    },
    dashmap::DashMap,
    pythnet_sdk::messages::{
        FeedId,
        Message,
        MessageType,
    },
    std::{
        collections::BTreeMap,
        ops::Bound,
        sync::Arc,
    },
    strum::IntoEnumIterator,
    tokio::sync::RwLock,
};

#[derive(Clone, PartialEq, Eq, Debug, Hash)]
pub struct MessageStateKey {
    pub feed_id: FeedId,
    pub type_:   MessageType,
}

#[derive(Clone, PartialEq, Eq, Debug, PartialOrd, Ord)]
pub struct MessageStateTime {
    pub publish_time: UnixTimestamp,
    pub slot:         Slot,
}

#[derive(Clone, PartialEq, Debug)]
pub struct MessageState {
    pub slot:        Slot,
    pub message:     Message,
    pub raw_message: RawMessage,
    pub proof_set:   ProofSet,
    pub received_at: UnixTimestamp,
}

impl MessageState {
    pub fn time(&self) -> MessageStateTime {
        MessageStateTime {
            publish_time: self.message.publish_time(),
            slot:         self.slot,
        }
    }

    pub fn key(&self) -> MessageStateKey {
        MessageStateKey {
            feed_id: self.message.feed_id(),
            type_:   self.message.into(),
        }
    }

    pub fn new(
        message: Message,
        raw_message: RawMessage,
        proof_set: ProofSet,
        slot: Slot,
        received_at: UnixTimestamp,
    ) -> Self {
        Self {
            slot,
            message,
            raw_message,
            proof_set,
            received_at,
        }
    }
}

#[derive(Clone, Copy)]
#[allow(dead_code)]
pub enum MessageStateFilter {
    All,
    Only(MessageType),
}

pub struct Storage {
    message_cache: Arc<DashMap<MessageStateKey, BTreeMap<MessageStateTime, MessageState>>>,
    /// Accumulator messages cache
    ///
    /// We do not write to this cache much, so we can use a simple RwLock instead of a DashMap.
    accumulator_messages_cache:  Arc<RwLock<BTreeMap<Slot, AccumulatorMessages>>>,
    /// Wormhole merkle state cache
    ///
    /// We do not write to this cache much, so we can use a simple RwLock instead of a DashMap.
    wormhole_merkle_state_cache: Arc<RwLock<BTreeMap<Slot, WormholeMerkleState>>>,
    cache_size:                  u64,
}

impl Storage {
    pub fn new(cache_size: u64) -> Self {
        Self {
            message_cache: Arc::new(DashMap::new()),
            accumulator_messages_cache: Arc::new(RwLock::new(BTreeMap::new())),
            wormhole_merkle_state_cache: Arc::new(RwLock::new(BTreeMap::new())),
            cache_size,
        }
    }

    pub async fn message_state_keys(&self) -> Vec<MessageStateKey> {
        self.message_cache
            .iter()
            .map(|entry| entry.key().clone())
            .collect::<Vec<_>>()
    }

    pub async fn store_message_states(&self, message_states: Vec<MessageState>) -> Result<()> {
        for message_state in message_states {
            let key = message_state.key();
            let time = message_state.time();
            let mut cache = self.message_cache.entry(key).or_insert_with(BTreeMap::new);

            cache.insert(time, message_state);

            // Remove the earliest message states if the cache size is exceeded
            while cache.len() > self.cache_size as usize {
                cache.pop_first();
            }
        }
        Ok(())
    }

    fn retrieve_message_state(
        &self,
        key: MessageStateKey,
        request_time: RequestTime,
    ) -> Option<MessageState> {
        match self.message_cache.get(&key) {
            Some(key_cache) => {
                match request_time {
                    RequestTime::Latest => key_cache.last_key_value().map(|(_, v)| v).cloned(),
                    RequestTime::FirstAfter(time) => {
                        // If the requested time is before the first element in the vector, we are
                        // not sure that the first element is the closest one.
                        if let Some((_, oldest_record_value)) = key_cache.first_key_value() {
                            if time < oldest_record_value.time().publish_time {
                                return None;
                            }
                        }

                        let lookup_time = MessageStateTime {
                            publish_time: time,
                            slot:         0,
                        };

                        // Get the first element that is greater than or equal to the lookup time.
                        key_cache
                            .lower_bound(Bound::Included(&lookup_time))
                            .value()
                            .cloned()
                    }
                }
            }
            None => None,
        }
    }

    pub async fn fetch_message_states(
        &self,
        ids: Vec<FeedId>,
        request_time: RequestTime,
        filter: MessageStateFilter,
    ) -> Result<Vec<MessageState>> {
        ids.into_iter()
            .flat_map(|id| {
                let request_time = request_time.clone();
                let message_types: Vec<MessageType> = match filter {
                    MessageStateFilter::All => MessageType::iter().collect(),
                    MessageStateFilter::Only(t) => vec![t],
                };

                message_types.into_iter().map(move |message_type| {
                    let key = MessageStateKey {
                        feed_id: id,
                        type_:   message_type,
                    };
                    self.retrieve_message_state(key, request_time.clone())
                        .ok_or(anyhow!("Message not found"))
                })
            })
            .collect()
    }

    pub async fn store_accumulator_messages(
        &self,
        accumulator_messages: AccumulatorMessages,
    ) -> Result<()> {
        let mut cache = self.accumulator_messages_cache.write().await;
        cache.insert(accumulator_messages.slot, accumulator_messages);
        while cache.len() > self.cache_size as usize {
            cache.pop_first();
        }
        Ok(())
    }

    pub async fn fetch_accumulator_messages(
        &self,
        slot: Slot,
    ) -> Result<Option<AccumulatorMessages>> {
        let cache = self.accumulator_messages_cache.read().await;
        Ok(cache.get(&slot).cloned())
    }

    pub async fn store_wormhole_merkle_state(
        &self,
        wormhole_merkle_state: WormholeMerkleState,
    ) -> Result<()> {
        let mut cache = self.wormhole_merkle_state_cache.write().await;
        cache.insert(wormhole_merkle_state.root.slot, wormhole_merkle_state);
        while cache.len() > self.cache_size as usize {
            cache.pop_first();
        }
        Ok(())
    }

    pub async fn fetch_wormhole_merkle_state(
        &self,
        slot: Slot,
    ) -> Result<Option<WormholeMerkleState>> {
        let cache = self.wormhole_merkle_state_cache.read().await;
        Ok(cache.get(&slot).cloned())
    }
}

#[cfg(test)]
mod test {
    use {
        super::*,
        crate::store::{
            proof::wormhole_merkle::{
                WormholeMerkleMessageProof,
                WormholeMerkleState,
            },
            types::{
                AccumulatorMessages,
                ProofSet,
            },
        },
        pyth_sdk::UnixTimestamp,
        pythnet_sdk::{
            accumulators::merkle::MerklePath,
            hashers::keccak256_160::Keccak160,
            messages::{
                Message,
                PriceFeedMessage,
            },
            wire::v1::WormholeMerkleRoot,
        },
    };

    pub fn create_dummy_price_feed_message_state(
        feed_id: FeedId,
        publish_time: i64,
        slot: Slot,
    ) -> MessageState {
        MessageState {
            slot,
            raw_message: vec![],
            message: Message::PriceFeedMessage(PriceFeedMessage {
                feed_id,
                publish_time,
                price: 1,
                conf: 2,
                exponent: 3,
                ema_price: 4,
                ema_conf: 5,
                prev_publish_time: 6,
            }),
            received_at: publish_time,
            proof_set: ProofSet {
                wormhole_merkle_proof: WormholeMerkleMessageProof {
                    vaa:   vec![],
                    proof: MerklePath::<Keccak160>::new(vec![]),
                },
            },
        }
    }

    pub async fn create_and_store_dummy_price_feed_message_state(
        storage: &Storage,
        feed_id: FeedId,
        publish_time: UnixTimestamp,
        slot: Slot,
    ) -> MessageState {
        let message_state = create_dummy_price_feed_message_state(feed_id, publish_time, slot);
        storage
            .store_message_states(vec![message_state.clone()])
            .await
            .unwrap();
        message_state
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_latest_message_state_works() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = Storage::new(2);

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let message_state =
            create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 5).await;

        // The latest message state should be the one we just stored.
        assert_eq!(
            storage
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::Latest,
                    MessageStateFilter::Only(MessageType::PriceFeedMessage),
                )
                .await
                .unwrap(),
            vec![message_state]
        );
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_latest_message_state_with_multiple_update_works() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = Storage::new(2);

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let _old_message_state =
            create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 20 at slot 10.
        let new_message_state =
            create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 20, 10).await;

        // The latest message state should be the one with publish time 20.
        assert_eq!(
            storage
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::Latest,
                    MessageStateFilter::Only(MessageType::PriceFeedMessage)
                )
                .await
                .unwrap(),
            vec![new_message_state]
        );
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_latest_message_state_with_out_of_order_update_works() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = Storage::new(2);

        // Create and store a message state with feed id [1....] and publish time 20 at slot 10.
        let new_message_state =
            create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 20, 10).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let _old_message_state =
            create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 5).await;

        // The latest message state should be the one with publish time 20.
        assert_eq!(
            storage
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::Latest,
                    MessageStateFilter::Only(MessageType::PriceFeedMessage)
                )
                .await
                .unwrap(),
            vec![new_message_state]
        );
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_first_after_message_state_works() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = Storage::new(2);

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let old_message_state =
            create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 13 at slot 10.
        let new_message_state =
            create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 13, 10).await;

        // The first message state after time 10 should be the old message state.
        assert_eq!(
            storage
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::FirstAfter(10),
                    MessageStateFilter::Only(MessageType::PriceFeedMessage)
                )
                .await
                .unwrap(),
            vec![old_message_state]
        );

        // Querying the first after pub time 11, 12, 13 should all return the new message state.
        for request_time in 11..14 {
            assert_eq!(
                storage
                    .fetch_message_states(
                        vec![[1; 32]],
                        RequestTime::FirstAfter(request_time),
                        MessageStateFilter::Only(MessageType::PriceFeedMessage)
                    )
                    .await
                    .unwrap(),
                vec![new_message_state.clone()]
            );
        }
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_latest_message_state_with_same_pubtime_works() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = Storage::new(2);

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let slightly_older_message_state =
            create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 7.
        let slightly_newer_message_state =
            create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 7).await;

        // The latest message state should be the one with the higher slot.
        assert_eq!(
            storage
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::Latest,
                    MessageStateFilter::Only(MessageType::PriceFeedMessage),
                )
                .await
                .unwrap(),
            vec![slightly_newer_message_state]
        );

        // Querying the first message state after time 10 should return the one with the lower slot.
        assert_eq!(
            storage
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::FirstAfter(10),
                    MessageStateFilter::Only(MessageType::PriceFeedMessage),
                )
                .await
                .unwrap(),
            vec![slightly_older_message_state]
        );
    }


    #[tokio::test]
    pub async fn test_store_and_retrieve_first_after_message_state_fails_for_past_time() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = Storage::new(2);

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 13 at slot 10.
        create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 13, 10).await;

        // Query the message state before the available times should return an error.
        // This is because we are not sure that the first available message is really the first.
        assert!(storage
            .fetch_message_states(
                vec![[1; 32]],
                RequestTime::FirstAfter(9),
                MessageStateFilter::Only(MessageType::PriceFeedMessage)
            )
            .await
            .is_err());
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_first_after_message_state_fails_for_future_time() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = Storage::new(2);

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 13 at slot 10.
        create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 13, 10).await;

        // Query the message state after the available times should return an error.
        assert!(storage
            .fetch_message_states(
                vec![[1; 32]],
                RequestTime::FirstAfter(14),
                MessageStateFilter::Only(MessageType::PriceFeedMessage)
            )
            .await
            .is_err());
    }

    #[tokio::test]
    pub async fn test_store_more_message_states_than_cache_size_evicts_old_messages() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = Storage::new(2);

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 13 at slot 10.
        create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 13, 10).await;

        // Create and store a message state with feed id [1....] and publish time 20 at slot 14.
        create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 20, 14).await;

        // The message at time 10 should be evicted and querying for it should return an error.
        assert!(storage
            .fetch_message_states(
                vec![[1; 32]],
                RequestTime::FirstAfter(10),
                MessageStateFilter::Only(MessageType::PriceFeedMessage)
            )
            .await
            .is_err());
    }

    #[tokio::test]
    pub async fn test_store_and_fetch_multiple_message_feed_ids_works() {
        // Initialize a storage with a cache size of 1 per key.
        let storage = Storage::new(1);

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let message_state_1 =
            create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [2....] and publish time 13 at slot 10.
        let message_state_2 =
            create_and_store_dummy_price_feed_message_state(&storage, [2; 32], 10, 5).await;

        // Check both message states can be retrieved.
        assert_eq!(
            storage
                .fetch_message_states(
                    vec![[1; 32], [2; 32]],
                    RequestTime::Latest,
                    MessageStateFilter::Only(MessageType::PriceFeedMessage),
                )
                .await
                .unwrap(),
            vec![message_state_1, message_state_2]
        );
    }

    #[tokio::test]
    pub async fn test_fetch_not_existent_message_fails() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = Storage::new(2);

        create_and_store_dummy_price_feed_message_state(&storage, [1; 32], 10, 5).await;

        // Check both message states can be retrieved.
        assert!(storage
            .fetch_message_states(
                vec![[2; 32]],
                RequestTime::Latest,
                MessageStateFilter::Only(MessageType::PriceFeedMessage),
            )
            .await
            .is_err());
    }

    pub fn create_empty_accumulator_messages_at_slot(slot: Slot) -> AccumulatorMessages {
        AccumulatorMessages {
            magic: [0; 4],
            slot,
            ring_size: 3,
            raw_messages: vec![],
        }
    }

    #[tokio::test]
    pub async fn test_store_and_fetch_accumulator_messages_works() {
        // Initialize a storage with a cache size of 2 per key and the accumulator state.
        let storage = Storage::new(2);

        // Make sure the retrieved accumulator messages is what we store.
        let mut accumulator_messages_at_10 = create_empty_accumulator_messages_at_slot(10);
        storage
            .store_accumulator_messages(accumulator_messages_at_10.clone())
            .await
            .unwrap();
        assert_eq!(
            storage
                .fetch_accumulator_messages(10)
                .await
                .unwrap()
                .unwrap(),
            accumulator_messages_at_10
        );

        // Make sure overwriting the accumulator messages works.
        accumulator_messages_at_10.ring_size = 5; // Change the ring size from 3 to 5.
        storage
            .store_accumulator_messages(accumulator_messages_at_10.clone())
            .await
            .unwrap();
        assert_eq!(
            storage
                .fetch_accumulator_messages(10)
                .await
                .unwrap()
                .unwrap(),
            accumulator_messages_at_10
        );

        // Create and store an accumulator messages with slot 5 and check it's stored.
        let accumulator_messages_at_5 = create_empty_accumulator_messages_at_slot(5);
        storage
            .store_accumulator_messages(accumulator_messages_at_5.clone())
            .await
            .unwrap();
        assert_eq!(
            storage
                .fetch_accumulator_messages(5)
                .await
                .unwrap()
                .unwrap(),
            accumulator_messages_at_5
        );

        // Add a newer accumulator messages with slot 15 to exceed cache size and make sure the earliest is evicted.
        let accumulator_messages_at_15 = create_empty_accumulator_messages_at_slot(15);
        storage
            .store_accumulator_messages(accumulator_messages_at_15.clone())
            .await
            .unwrap();
        assert_eq!(
            storage
                .fetch_accumulator_messages(15)
                .await
                .unwrap()
                .unwrap(),
            accumulator_messages_at_15
        );
        assert!(storage
            .fetch_accumulator_messages(5)
            .await
            .unwrap()
            .is_none());
    }

    pub fn create_empty_wormhole_merkle_state_at_slot(slot: Slot) -> WormholeMerkleState {
        WormholeMerkleState {
            vaa:  vec![],
            root: WormholeMerkleRoot {
                slot,
                root: [0; 20],
                ring_size: 3,
            },
        }
    }

    #[tokio::test]
    pub async fn test_store_and_fetch_wormhole_merkle_state_works() {
        // Initialize a storage with a cache size of 2 per key and the accumulator state.
        let storage = Storage::new(2);

        // Make sure the retrieved wormhole merkle state is what we store
        let mut wormhole_merkle_state_at_10 = create_empty_wormhole_merkle_state_at_slot(10);
        storage
            .store_wormhole_merkle_state(wormhole_merkle_state_at_10.clone())
            .await
            .unwrap();
        assert_eq!(
            storage
                .fetch_wormhole_merkle_state(10)
                .await
                .unwrap()
                .unwrap(),
            wormhole_merkle_state_at_10
        );

        // Make sure overwriting the wormhole merkle state works.
        wormhole_merkle_state_at_10.root.ring_size = 5; // Change the ring size from 3 to 5.
        storage
            .store_wormhole_merkle_state(wormhole_merkle_state_at_10.clone())
            .await
            .unwrap();
        assert_eq!(
            storage
                .fetch_wormhole_merkle_state(10)
                .await
                .unwrap()
                .unwrap(),
            wormhole_merkle_state_at_10
        );

        // Create and store an wormhole merkle state with slot 5 and check it's stored.
        let wormhole_merkle_state_at_5 = create_empty_wormhole_merkle_state_at_slot(5);
        storage
            .store_wormhole_merkle_state(wormhole_merkle_state_at_5.clone())
            .await
            .unwrap();
        assert_eq!(
            storage
                .fetch_wormhole_merkle_state(5)
                .await
                .unwrap()
                .unwrap(),
            wormhole_merkle_state_at_5
        );

        // Add a newer wormhole merkle state with slot 15 to exceed cache size and make sure the earliest is evicted.
        let wormhole_merkle_state_at_15 = create_empty_wormhole_merkle_state_at_slot(15);
        storage
            .store_wormhole_merkle_state(wormhole_merkle_state_at_15.clone())
            .await
            .unwrap();
        assert_eq!(
            storage
                .fetch_wormhole_merkle_state(15)
                .await
                .unwrap()
                .unwrap(),
            wormhole_merkle_state_at_15
        );
        assert!(storage
            .fetch_wormhole_merkle_state(5)
            .await
            .unwrap()
            .is_none());
    }
}
