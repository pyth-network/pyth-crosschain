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
    moka::sync::Cache,
    pyth_sdk::PriceIdentifier,
    pythnet_sdk::messages::MessageType,
    std::{
        collections::VecDeque,
        sync::Arc,
    },
    strum::IntoEnumIterator,
};

#[derive(Clone)]
pub struct LocalStorage {
    message_cache:     Arc<DashMap<MessageStateKey, VecDeque<MessageState>>>,
    accumulator_cache: Cache<Slot, AccumulatorState>,
    cache_size:        u64,
}

impl LocalStorage {
    pub fn new_instance(cache_size: u64) -> StorageInstance {
        Box::new(Self {
            message_cache: Arc::new(DashMap::new()),
            accumulator_cache: Cache::builder().max_capacity(cache_size).build(),
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
        ids: Vec<PriceIdentifier>,
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
                        id:    id.to_bytes(),
                        type_: message_type,
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
        let key = state.slot;
        self.accumulator_cache.insert(key, state);
        Ok(())
    }

    async fn fetch_accumulator_state(&self, slot: Slot) -> Result<Option<super::AccumulatorState>> {
        Ok(self.accumulator_cache.get(&slot))
    }
}
