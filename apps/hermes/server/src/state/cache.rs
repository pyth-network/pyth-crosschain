use {
    super::State,
    crate::state::aggregate::{
        wormhole_merkle::WormholeMerkleState, AccumulatorMessages, ProofSet, RawMessage,
        RequestTime, Slot, UnixTimestamp,
    },
    anyhow::{anyhow, Result},
    futures::future::join_all,
    pythnet_sdk::messages::{FeedId, Message, MessageType},
    std::{
        collections::{BTreeMap, HashMap, HashSet},
        sync::Arc,
    },
    strum::IntoEnumIterator,
    tokio::sync::RwLock,
};

#[derive(Clone, PartialEq, Eq, Debug, Hash)]
pub struct MessageStateKey {
    pub feed_id: FeedId,
    pub type_: MessageType,
}

#[derive(Clone, PartialEq, Eq, Debug, PartialOrd, Ord)]
pub struct MessageStateTime {
    pub publish_time: UnixTimestamp,
    pub slot: Slot,
}

#[derive(Clone, PartialEq, Debug)]
pub struct MessageState {
    pub slot: Slot,
    pub message: Message,
    /// The raw updated message.
    ///
    /// We need to store the raw message binary because the Message
    /// struct might lose some data due to its support for forward
    /// compatibility.
    pub raw_message: RawMessage,
    pub proof_set: ProofSet,
    pub received_at: UnixTimestamp,
}

impl MessageState {
    pub fn time(&self) -> MessageStateTime {
        MessageStateTime {
            publish_time: self.message.publish_time(),
            slot: self.slot,
        }
    }

    pub fn key(&self) -> MessageStateKey {
        MessageStateKey {
            feed_id: self.message.feed_id(),
            type_: self.message.clone().into(),
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
pub enum MessageStateFilter {
    #[allow(dead_code, reason = "can be useful later")]
    All,
    Only(MessageType),
}

/// A Cache of AccumulatorMessage by slot. We do not write to this cache much, so we can use a simple RwLock instead of a DashMap.
type AccumulatorMessagesCache = Arc<RwLock<BTreeMap<Slot, AccumulatorMessages>>>;

/// A Cache of WormholeMerkleState by slot. We do not write to this cache much, so we can use a simple RwLock instead of a DashMap.
type WormholeMerkleStateCache = Arc<RwLock<BTreeMap<Slot, WormholeMerkleState>>>;

/// A Cache of `Time<->MessageState` by feed id.
type MessageCache = Arc<RwLock<HashMap<MessageStateKey, BTreeMap<MessageStateTime, MessageState>>>>;

/// A collection of caches for various program state.
pub struct CacheState {
    accumulator_messages_cache: AccumulatorMessagesCache,
    wormhole_merkle_state_cache: WormholeMerkleStateCache,
    message_cache: MessageCache,
    cache_size: usize,
}

impl CacheState {
    pub fn new(size: usize) -> Self {
        Self {
            accumulator_messages_cache: Arc::new(RwLock::new(BTreeMap::new())),
            wormhole_merkle_state_cache: Arc::new(RwLock::new(BTreeMap::new())),
            message_cache: Arc::new(RwLock::new(HashMap::new())),
            cache_size: size,
        }
    }
}

/// Allow downcasting State into CacheState for functions that depend on the `Cache` service.
impl<'a> From<&'a State> for &'a CacheState {
    fn from(state: &'a State) -> &'a CacheState {
        &state.cache
    }
}

#[async_trait::async_trait]
pub trait Cache {
    async fn store_message_states(&self, message_states: Vec<MessageState>) -> Result<()>;
    async fn prune_removed_keys(&self, current_keys: HashSet<MessageStateKey>);
    async fn store_accumulator_messages(
        &self,
        accumulator_messages: AccumulatorMessages,
    ) -> Result<bool>;
    async fn fetch_accumulator_messages(&self, slot: Slot) -> Result<Option<AccumulatorMessages>>;
    async fn store_wormhole_merkle_state(
        &self,
        wormhole_merkle_state: WormholeMerkleState,
    ) -> Result<bool>;
    async fn fetch_wormhole_merkle_state(&self, slot: Slot) -> Result<Option<WormholeMerkleState>>;
    async fn message_state_keys(&self) -> Vec<MessageStateKey>;
    async fn fetch_message_states(
        &self,
        ids: Vec<FeedId>,
        request_time: RequestTime,
        filter: MessageStateFilter,
    ) -> Result<Vec<MessageState>>;
}

#[async_trait::async_trait]
impl<T> Cache for T
where
    for<'a> &'a T: Into<&'a CacheState>,
    T: Sync,
{
    async fn message_state_keys(&self) -> Vec<MessageStateKey> {
        self.into()
            .message_cache
            .read()
            .await
            .iter()
            .map(|entry| entry.0.clone())
            .collect::<Vec<_>>()
    }

    async fn store_message_states(&self, message_states: Vec<MessageState>) -> Result<()> {
        let mut message_cache = self.into().message_cache.write().await;

        for message_state in message_states {
            let key = message_state.key();
            let time = message_state.time();
            let cache = message_cache.entry(key).or_insert_with(BTreeMap::new);
            cache.insert(time, message_state);

            // Remove the earliest message states if the cache size is exceeded
            while cache.len() > self.into().cache_size {
                cache.pop_first();
            }
        }

        Ok(())
    }

    /// This method takes the current feed ids and prunes the cache for the keys
    /// that are not present in the current feed ids.
    ///
    /// There is a side-effect of this: if a key gets removed, we will
    /// lose the cache for that key and cannot retrieve it for historical
    /// price queries.
    async fn prune_removed_keys(&self, current_keys: HashSet<MessageStateKey>) {
        let mut message_cache = self.into().message_cache.write().await;

        // Sometimes, some keys are removed from the accumulator. We track which keys are not
        // present in the message states and remove them from the cache.
        let keys_in_cache = message_cache
            .iter()
            .map(|(key, _)| key.clone())
            .collect::<HashSet<_>>();

        for key in keys_in_cache {
            if !current_keys.contains(&key) {
                tracing::info!("Feed {:?} seems to be removed. Removing it from cache", key);
                message_cache.remove(&key);
            }
        }
    }

    async fn fetch_message_states(
        &self,
        ids: Vec<FeedId>,
        request_time: RequestTime,
        filter: MessageStateFilter,
    ) -> Result<Vec<MessageState>> {
        join_all(ids.into_iter().flat_map(|id| {
            let request_time = request_time.clone();
            let message_types: Vec<MessageType> = match filter {
                MessageStateFilter::All => MessageType::iter().collect(),
                MessageStateFilter::Only(t) => vec![t],
            };

            message_types.into_iter().map(move |message_type| {
                let key = MessageStateKey {
                    feed_id: id,
                    type_: message_type,
                };
                retrieve_message_state(self.into(), key, request_time.clone())
            })
        }))
        .await
        .into_iter()
        .collect::<Option<Vec<_>>>()
        .ok_or(anyhow!("Message not found"))
    }

    async fn store_accumulator_messages(
        &self,
        accumulator_messages: AccumulatorMessages,
    ) -> Result<bool> {
        let mut cache = self.into().accumulator_messages_cache.write().await;
        let slot = accumulator_messages.slot;

        // Check if we already have messages for this slot while holding the lock
        if cache.contains_key(&slot) {
            // Messages already exist, return false to indicate no insertion happened
            return Ok(false);
        }

        // Messages don't exist, store them
        cache.insert(slot, accumulator_messages);
        while cache.len() > self.into().cache_size {
            cache.pop_first();
        }
        Ok(true)
    }

    async fn fetch_accumulator_messages(&self, slot: Slot) -> Result<Option<AccumulatorMessages>> {
        let cache = self.into().accumulator_messages_cache.read().await;
        Ok(cache.get(&slot).cloned())
    }

    async fn store_wormhole_merkle_state(
        &self,
        wormhole_merkle_state: WormholeMerkleState,
    ) -> Result<bool> {
        let mut cache = self.into().wormhole_merkle_state_cache.write().await;
        let slot = wormhole_merkle_state.root.slot;

        // Check if we already have a state for this slot while holding the lock
        if cache.contains_key(&slot) {
            // State already exists, return false to indicate no insertion happened
            return Ok(false);
        }

        // State doesn't exist, store it
        cache.insert(slot, wormhole_merkle_state);
        while cache.len() > self.into().cache_size {
            cache.pop_first();
        }
        Ok(true)
    }

    async fn fetch_wormhole_merkle_state(&self, slot: Slot) -> Result<Option<WormholeMerkleState>> {
        let cache = self.into().wormhole_merkle_state_cache.read().await;
        Ok(cache.get(&slot).cloned())
    }
}

async fn retrieve_message_state(
    cache: &CacheState,
    key: MessageStateKey,
    request_time: RequestTime,
) -> Option<MessageState> {
    match cache.message_cache.read().await.get(&key) {
        Some(key_cache) => {
            match request_time {
                RequestTime::Latest => key_cache.last_key_value().map(|(_, v)| v).cloned(),
                RequestTime::LatestTimeEarliestSlot => {
                    // Get the latest publish time from the last entry
                    let last_entry = key_cache.last_key_value()?;
                    let latest_publish_time = last_entry.0.publish_time;
                    let mut latest_entry_with_earliest_slot = last_entry;

                    // Walk backwards through the sorted entries rather than use `range` since we will only
                    // have a couple entries that have the same publish_time.
                    // We have acquired the RwLock via read() above, so we should be safe to reenter the cache here.
                    for (k, v) in key_cache.iter().rev() {
                        if k.publish_time < latest_publish_time {
                            // We've found an entry with an earlier publish time
                            break;
                        }

                        // Update our tracked entry (the reverse iteration will find entries
                        // with higher slots first, so we'll end up with the lowest slot)
                        latest_entry_with_earliest_slot = (k, v);
                    }

                    Some(latest_entry_with_earliest_slot.1.clone())
                }
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
                        slot: 0,
                    };

                    // Get the first element that is greater than or equal to the lookup time.
                    key_cache
                        .range(lookup_time..)
                        .next()
                        .map(|(_, v)| v)
                        .cloned()
                }
                RequestTime::AtSlot(slot) => {
                    // Get the state with slot equal to the lookup slot.
                    key_cache
                        .iter()
                        .rev() // Usually the slot lies at the end of the map
                        .find(|(k, _)| k.slot == slot)
                        .map(|(_, v)| v)
                        .cloned()
                }
            }
        }
        None => None,
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, reason = "tests")]
mod test {
    use {
        super::*,
        crate::state::{aggregate::wormhole_merkle::WormholeMerkleMessageProof, test::setup_state},
        pyth_sdk::UnixTimestamp,
        pythnet_sdk::{
            accumulators::merkle::MerklePath, hashers::keccak256_160::Keccak160,
            messages::PriceFeedMessage, wire::v1::WormholeMerkleRoot,
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
                    vaa: vec![],
                    proof: MerklePath::<Keccak160>::new(vec![]),
                },
            },
        }
    }

    #[cfg(test)]
    pub async fn create_and_store_dummy_price_feed_message_state<S>(
        state: &S,
        feed_id: FeedId,
        publish_time: UnixTimestamp,
        slot: Slot,
    ) -> MessageState
    where
        S: Cache,
    {
        let message_state = create_dummy_price_feed_message_state(feed_id, publish_time, slot);
        state
            .store_message_states(vec![message_state.clone()])
            .await
            .unwrap();
        message_state
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_latest_message_state_works() {
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // The latest message state should be the one we just stored.
        assert_eq!(
            state
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
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let _old_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 20 at slot 10.
        let new_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 20, 10).await;

        // The latest message state should be the one with publish time 20.
        assert_eq!(
            state
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
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Create and store a message state with feed id [1....] and publish time 20 at slot 10.
        let new_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 20, 10).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let _old_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // The latest message state should be the one with publish time 20.
        assert_eq!(
            state
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
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let old_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 13 at slot 10.
        let new_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 13, 10).await;

        // The first message state after time 10 should be the old message state.
        assert_eq!(
            state
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
                state
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
    pub async fn test_store_and_retrieve_at_slot_message_state_works() {
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let old_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 13 at slot 10.
        let new_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 13, 10).await;

        // The first message state at slot 5 should be the old message state.
        assert_eq!(
            state
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::AtSlot(5),
                    MessageStateFilter::Only(MessageType::PriceFeedMessage)
                )
                .await
                .unwrap(),
            vec![old_message_state]
        );

        // Querying the slot at for slots 6..9 should all return None.
        for request_slot in 6..10 {
            assert!(state
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::AtSlot(request_slot),
                    MessageStateFilter::Only(MessageType::PriceFeedMessage)
                )
                .await
                .is_err());
        }

        // The first message state at slot 10 should be the new message state.
        assert_eq!(
            state
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::AtSlot(10),
                    MessageStateFilter::Only(MessageType::PriceFeedMessage)
                )
                .await
                .unwrap(),
            vec![new_message_state]
        );
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_latest_message_state_with_same_pubtime_works() {
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let slightly_older_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 7.
        let slightly_newer_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 7).await;

        // The latest message state should be the one with the higher slot.
        assert_eq!(
            state
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
            state
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
    pub async fn test_latest_time_earliest_slot_request_works() {
        // Initialize state with a cache size of 3 per key.
        let (state, _) = setup_state(3).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 7.
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 7).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 10.
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 10).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let earliest_slot_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 8 at slot 3.
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 8, 3).await;

        // The LatestTimeEarliestSlot should return the message with publish time 10 at slot 5
        assert_eq!(
            state
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::LatestTimeEarliestSlot,
                    MessageStateFilter::Only(MessageType::PriceFeedMessage),
                )
                .await
                .unwrap(),
            vec![earliest_slot_message_state]
        );

        // Create and store a message state with feed id [1....] and publish time 15 at slot 20.
        let newer_time_message_state =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 15, 20).await;

        // The LatestTimeEarliestSlot should now return the message with publish time 15
        assert_eq!(
            state
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::LatestTimeEarliestSlot,
                    MessageStateFilter::Only(MessageType::PriceFeedMessage),
                )
                .await
                .unwrap(),
            vec![newer_time_message_state]
        );

        // Store two messages with even later publish time but different slots
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 20, 35).await;
        let latest_time_earliest_slot_message =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 20, 30).await;

        // The LatestTimeEarliestSlot should return the message with publish time 20 at slot 30
        assert_eq!(
            state
                .fetch_message_states(
                    vec![[1; 32]],
                    RequestTime::LatestTimeEarliestSlot,
                    MessageStateFilter::Only(MessageType::PriceFeedMessage),
                )
                .await
                .unwrap(),
            vec![latest_time_earliest_slot_message]
        );
    }

    #[tokio::test]
    pub async fn test_store_and_retrieve_first_after_message_state_fails_for_past_time() {
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 13 at slot 10.
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 13, 10).await;

        // Query the message state before the available times should return an error.
        // This is because we are not sure that the first available message is really the first.
        assert!(state
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
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 13 at slot 10.
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 13, 10).await;

        // Query the message state after the available times should return an error.
        assert!(state
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
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [1....] and publish time 13 at slot 10.
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 13, 10).await;

        // Create and store a message state with feed id [1....] and publish time 20 at slot 14.
        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 20, 14).await;

        // The message at time 10 should be evicted and querying for it should return an error.
        assert!(state
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
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Create and store a message state with feed id [1....] and publish time 10 at slot 5.
        let message_state_1 =
            create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // Create and store a message state with feed id [2....] and publish time 13 at slot 10.
        let message_state_2 =
            create_and_store_dummy_price_feed_message_state(&*state, [2; 32], 10, 5).await;

        // Check both message states can be retrieved.
        assert_eq!(
            state
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
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        create_and_store_dummy_price_feed_message_state(&*state, [1; 32], 10, 5).await;

        // Check both message states can be retrieved.
        assert!(state
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
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Make sure the retrieved accumulator messages is what we store.
        let accumulator_messages_at_10 = create_empty_accumulator_messages_at_slot(10);
        state
            .store_accumulator_messages(accumulator_messages_at_10.clone())
            .await
            .unwrap();
        assert_eq!(
            state.fetch_accumulator_messages(10).await.unwrap().unwrap(),
            accumulator_messages_at_10
        );

        // Create and store an accumulator messages with slot 5 and check it's stored.
        let accumulator_messages_at_5 = create_empty_accumulator_messages_at_slot(5);
        state
            .store_accumulator_messages(accumulator_messages_at_5.clone())
            .await
            .unwrap();
        assert_eq!(
            state.fetch_accumulator_messages(5).await.unwrap().unwrap(),
            accumulator_messages_at_5
        );

        // Add a newer accumulator messages with slot 15 to exceed cache size and make sure the earliest is evicted.
        let accumulator_messages_at_15 = create_empty_accumulator_messages_at_slot(15);
        state
            .store_accumulator_messages(accumulator_messages_at_15.clone())
            .await
            .unwrap();
        assert_eq!(
            state.fetch_accumulator_messages(15).await.unwrap().unwrap(),
            accumulator_messages_at_15
        );
        assert!(state.fetch_accumulator_messages(5).await.unwrap().is_none());
    }

    pub fn create_empty_wormhole_merkle_state_at_slot(slot: Slot) -> WormholeMerkleState {
        WormholeMerkleState {
            vaa: vec![],
            root: WormholeMerkleRoot {
                slot,
                root: [0; 20],
                ring_size: 3,
            },
        }
    }

    #[tokio::test]
    pub async fn test_store_and_fetch_wormhole_merkle_state_works() {
        // Initialize state with a cache size of 2 per key.
        let (state, _) = setup_state(2).await;

        // Make sure the retrieved wormhole merkle state is what we store
        let wormhole_merkle_state_at_10 = create_empty_wormhole_merkle_state_at_slot(10);
        state
            .store_wormhole_merkle_state(wormhole_merkle_state_at_10.clone())
            .await
            .unwrap();
        assert_eq!(
            state
                .fetch_wormhole_merkle_state(10)
                .await
                .unwrap()
                .unwrap(),
            wormhole_merkle_state_at_10
        );

        // Create and store an wormhole merkle state with slot 5 and check it's stored.
        let wormhole_merkle_state_at_5 = create_empty_wormhole_merkle_state_at_slot(5);
        state
            .store_wormhole_merkle_state(wormhole_merkle_state_at_5.clone())
            .await
            .unwrap();
        assert_eq!(
            state.fetch_wormhole_merkle_state(5).await.unwrap().unwrap(),
            wormhole_merkle_state_at_5
        );

        // Add a newer wormhole merkle state with slot 15 to exceed cache size and make sure the earliest is evicted.
        let wormhole_merkle_state_at_15 = create_empty_wormhole_merkle_state_at_slot(15);
        state
            .store_wormhole_merkle_state(wormhole_merkle_state_at_15.clone())
            .await
            .unwrap();
        assert_eq!(
            state
                .fetch_wormhole_merkle_state(15)
                .await
                .unwrap()
                .unwrap(),
            wormhole_merkle_state_at_15
        );
        assert!(state
            .fetch_wormhole_merkle_state(5)
            .await
            .unwrap()
            .is_none());
    }
}
