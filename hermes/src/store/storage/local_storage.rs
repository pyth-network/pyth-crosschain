use {
    super::{
        AccumulatorState,
        MessageState,
        MessageStateFilter,
        MessageStateKey,
        MessageStateTime,
        RequestTime,
        Storage,
        StorageInstance,
    },
    crate::store::types::Slot,
    anyhow::{
        anyhow,
        Result,
    },
    async_trait::async_trait,
    dashmap::DashMap,
    pythnet_sdk::messages::{
        FeedId,
        MessageType,
    },
    std::{
        collections::VecDeque,
        sync::Arc,
    },
    strum::IntoEnumIterator,
    tokio::sync::RwLock,
};

#[derive(Clone)]
pub struct LocalStorage {
    message_cache:     Arc<DashMap<MessageStateKey, VecDeque<MessageState>>>,
    accumulator_cache: Arc<RwLock<VecDeque<AccumulatorState>>>,
    cache_size:        u64,
}

impl LocalStorage {
    pub fn new_instance(cache_size: u64) -> StorageInstance {
        Box::new(Self {
            message_cache: Arc::new(DashMap::new()),
            accumulator_cache: Arc::new(RwLock::new(VecDeque::new())),
            cache_size,
        })
    }

    fn retrieve_message_state(
        &self,
        key: MessageStateKey,
        request_time: RequestTime,
    ) -> Option<MessageState> {
        match self.message_cache.get(&key) {
            Some(key_cache) => {
                match request_time {
                    RequestTime::Latest => key_cache.back().cloned(),
                    RequestTime::FirstAfter(time) => {
                        // If the requested time is before the first element in the vector, we are
                        // not sure that the first element is the closest one.
                        if let Some(oldest_record) = key_cache.front() {
                            if time < oldest_record.time().publish_time {
                                return None;
                            }
                        }

                        let lookup_time = MessageStateTime {
                            publish_time: time,
                            slot:         0,
                        };

                        // Binary search returns Ok(idx) if the element is found at index idx or Err(idx) if it's not
                        // found which idx is the index where the element should be inserted to keep the vector sorted.
                        // Getting idx within any of the match arms will give us the index of the element that is
                        // closest after or equal to the requested time.
                        let idx = match key_cache
                            .binary_search_by_key(&lookup_time, |record| record.time())
                        {
                            Ok(idx) => idx,
                            Err(idx) => idx,
                        };

                        // We are using `get` to handle out of bound idx. This happens if the
                        // requested time is after the last element in the vector.
                        key_cache.get(idx).cloned()
                    }
                }
            }
            None => None,
        }
    }
}

#[async_trait]
impl Storage for LocalStorage {
    /// Add a new db entry to the cache.
    ///
    /// This method keeps the backed store sorted for efficiency, and removes
    /// the oldest record in the cache if the max_size is reached. Entries are
    /// usually added in increasing order and likely to be inserted near the
    /// end of the deque. The function is optimized for this specific case.
    async fn store_message_states(&self, message_states: Vec<MessageState>) -> Result<()> {
        for message_state in message_states {
            let key = message_state.key();

            let mut key_cache = self.message_cache.entry(key).or_insert_with(VecDeque::new);

            key_cache.push_back(message_state);

            // Shift the pushed record until it's in the right place.
            let mut i = key_cache.len().saturating_sub(1);
            while i > 0 && key_cache[i - 1].time() > key_cache[i].time() {
                key_cache.swap(i - 1, i);
                i -= 1;
            }

            // FIXME remove equal elements by key and time

            // Remove the oldest record if the max size is reached.
            if key_cache.len() > self.cache_size as usize {
                key_cache.pop_front();
            }
        }

        Ok(())
    }

    async fn fetch_message_states(
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

    async fn message_state_keys(&self) -> Vec<MessageStateKey> {
        self.message_cache
            .iter()
            .map(|entry| entry.key().clone())
            .collect()
    }

    async fn store_accumulator_state(&self, state: super::AccumulatorState) -> Result<()> {
        let mut accumulator_cache = self.accumulator_cache.write().await;
        accumulator_cache.push_back(state);

        let mut i = accumulator_cache.len().saturating_sub(1);
        while i > 0 && accumulator_cache[i - 1].slot > accumulator_cache[i].slot {
            accumulator_cache.swap(i - 1, i);
            i -= 1;
        }

        if accumulator_cache.len() > self.cache_size as usize {
            accumulator_cache.pop_front();
        }

        Ok(())
    }

    async fn fetch_accumulator_state(&self, slot: Slot) -> Result<Option<super::AccumulatorState>> {
        let accumulator_cache = self.accumulator_cache.read().await;
        match accumulator_cache.binary_search_by_key(&slot, |state| state.slot) {
            Ok(idx) => Ok(accumulator_cache.get(idx).cloned()),
            Err(_) => Ok(None),
        }
    }
}

#[cfg(test)]
mod test {
    use {
        super::*,
        crate::store::{
            proof::wormhole_merkle::WormholeMerkleMessageProof,
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
        },
    };

    pub fn create_dummy_price_feed_message_state(
        feed_id: FeedId,
        publish_time: i64,
        slot: Slot,
    ) -> MessageState {
        MessageState {
            slot,
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
        storage: &StorageInstance,
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
        let storage = LocalStorage::new_instance(2);

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
        let storage = LocalStorage::new_instance(2);

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
            vec![new_message_state.clone()]
        );
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_latest_message_state_with_out_of_order_update_works() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = LocalStorage::new_instance(2);

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
            vec![new_message_state.clone()]
        );
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_first_after_message_state_works() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = LocalStorage::new_instance(2);

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
        let storage = LocalStorage::new_instance(2);

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
        let storage = LocalStorage::new_instance(2);

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
        let storage = LocalStorage::new_instance(2);

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
        let storage = LocalStorage::new_instance(2);

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
    pub async fn test_store_and_receive_multiple_message_feed_ids_works() {
        // Initialize a storage with a cache size of 1 per key.
        let storage = LocalStorage::new_instance(1);

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
    pub async fn test_receive_not_existent_message_fails() {
        // Initialize a storage with a cache size of 2 per key.
        let storage = LocalStorage::new_instance(2);

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

    pub fn create_empty_accumulator_state_at_slot(slot: Slot) -> AccumulatorState {
        AccumulatorState {
            slot,
            accumulator_messages: None,
            wormhole_merkle_state: None,
        }
    }

    #[tokio::test]
    pub async fn test_store_and_receive_accumulator_state_works() {
        // Initialize a storage with a cache size of 2 per key and the accumulator state.
        let storage = LocalStorage::new_instance(2);

        // Create and store an accumulator state with slot 10.
        let accumulator_state = create_empty_accumulator_state_at_slot(10);

        // Store the accumulator state.
        storage
            .store_accumulator_state(accumulator_state.clone())
            .await
            .unwrap();

        // Make sure the retrieved accumulator state is what we stored.
        assert_eq!(
            storage.fetch_accumulator_state(10).await.unwrap().unwrap(),
            accumulator_state
        );
    }

    #[tokio::test]
    pub async fn test_store_and_receive_accumulator_state_works_on_overwrite() {
        // Initialize a storage with a cache size of 2 per key and the accumulator state.
        let storage = LocalStorage::new_instance(2);

        // Create and store an accumulator state with slot 10.
        let mut accumulator_state = create_empty_accumulator_state_at_slot(10);

        // Store the accumulator state.
        storage
            .store_accumulator_state(accumulator_state.clone())
            .await
            .unwrap();

        // Retrieve the accumulator state and make sure it is what we stored.
        assert_eq!(
            storage.fetch_accumulator_state(10).await.unwrap().unwrap(),
            accumulator_state
        );

        // Change the state to have accumulator messages
        // We mutate the existing state because the normal flow is like this.
        accumulator_state.accumulator_messages = Some(AccumulatorMessages {
            magic:     [0; 4],
            slot:      10,
            ring_size: 3,
            messages:  vec![],
        });

        // Store the accumulator state again.
        storage
            .store_accumulator_state(accumulator_state.clone())
            .await
            .unwrap();

        // Make sure the retrieved accumulator state is what we stored.
        assert_eq!(
            storage.fetch_accumulator_state(10).await.unwrap().unwrap(),
            accumulator_state
        );
    }

    #[tokio::test]
    pub async fn test_store_and_receive_multiple_accumulator_state_works() {
        // Initialize a storage with a cache size of 2 per key and the accumulator state.
        let storage = LocalStorage::new_instance(2);

        let accumulator_state_at_slot_10 = create_empty_accumulator_state_at_slot(10);
        let accumulator_state_at_slot_20 = create_empty_accumulator_state_at_slot(20);

        // Store the accumulator states.
        storage
            .store_accumulator_state(accumulator_state_at_slot_10.clone())
            .await
            .unwrap();

        storage
            .store_accumulator_state(accumulator_state_at_slot_20.clone())
            .await
            .unwrap();

        // Retrieve the accumulator states and make sure it is what we stored.
        assert_eq!(
            storage.fetch_accumulator_state(10).await.unwrap().unwrap(),
            accumulator_state_at_slot_10
        );

        assert_eq!(
            storage.fetch_accumulator_state(20).await.unwrap().unwrap(),
            accumulator_state_at_slot_20
        );
    }

    #[tokio::test]
    pub async fn test_store_and_receive_accumulator_state_evicts_cache() {
        // Initialize a storage with a cache size of 2 per key and the accumulator state.
        let storage = LocalStorage::new_instance(2);

        let accumulator_state_at_slot_10 = create_empty_accumulator_state_at_slot(10);
        storage
            .store_accumulator_state(accumulator_state_at_slot_10.clone())
            .await
            .unwrap();

        let accumulator_state_at_slot_20 = create_empty_accumulator_state_at_slot(20);
        storage
            .store_accumulator_state(accumulator_state_at_slot_20.clone())
            .await
            .unwrap();

        let accumulator_state_at_slot_30 = create_empty_accumulator_state_at_slot(30);
        storage
            .store_accumulator_state(accumulator_state_at_slot_30.clone())
            .await
            .unwrap();

        // The accumulator state at slot 10 should be evicted from the cache.
        assert_eq!(storage.fetch_accumulator_state(10).await.unwrap(), None);


        // Retrieve the rest of accumulator states and make sure it is what we stored.
        assert_eq!(
            storage.fetch_accumulator_state(20).await.unwrap().unwrap(),
            accumulator_state_at_slot_20
        );

        assert_eq!(
            storage.fetch_accumulator_state(30).await.unwrap().unwrap(),
            accumulator_state_at_slot_30
        );
    }
}
