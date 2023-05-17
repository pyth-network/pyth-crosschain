use {
    super::{
        MessageIdentifier,
        MessageKey,
        MessageState,
        RequestTime,
        RequestType,
        Storage,
        StorageInstance,
    },
    crate::store::types::MessageType,
    anyhow::{
        anyhow,
        Result,
    },
    dashmap::DashMap,
    std::{
        collections::VecDeque,
        sync::Arc,
    },
};

#[derive(Clone)]
pub struct LocalStorage {
    cache:            Arc<DashMap<MessageKey, VecDeque<MessageState>>>,
    max_size_per_key: usize,
}

impl LocalStorage {
    pub fn new_instance(max_size_per_key: usize) -> StorageInstance {
        Arc::new(Box::new(Self {
            cache: Arc::new(DashMap::new()),
            max_size_per_key,
        }))
    }

    fn retrieve_message_state(
        &self,
        key: MessageKey,
        request_time: RequestTime,
    ) -> Option<MessageState> {
        match self.cache.get(&key) {
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

                        // Binary search returns Ok(idx) if the element is found at index idx or Err(idx) if it's not
                        // found which idx is the index where the element should be inserted to keep the vector sorted.
                        // Getting idx within any of the match arms will give us the index of the element that is
                        // closest after or equal to the requested time.
                        let idx = match key_cache
                            .binary_search_by_key(&time, |record| record.time().publish_time)
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

impl Storage for LocalStorage {
    /// Add a new db entry to the cache.
    ///
    /// This method keeps the backed store sorted for efficiency, and removes
    /// the oldest record in the cache if the max_size is reached. Entries are
    /// usually added in increasing order and likely to be inserted near the
    /// end of the deque. The function is optimized for this specific case.
    fn store_message_states(&self, message_states: Vec<MessageState>) -> Result<()> {
        for message_state in message_states {
            let key = message_state.key();

            let mut key_cache = self.cache.entry(key).or_insert_with(VecDeque::new);

            key_cache.push_back(message_state);

            // Shift the pushed record until it's in the right place.
            let mut i = key_cache.len().saturating_sub(1);
            while i > 0 && key_cache[i - 1].time() > key_cache[i].time() {
                key_cache.swap(i - 1, i);
                i -= 1;
            }

            // FIXME remove equal elements by key and time

            // Remove the oldest record if the max size is reached.
            if key_cache.len() > self.max_size_per_key {
                key_cache.pop_front();
            }
        }

        Ok(())
    }

    fn retrieve_message_states(
        &self,
        ids: Vec<MessageIdentifier>,
        request_type: RequestType,
        request_time: RequestTime,
    ) -> Result<Vec<MessageState>> {
        // TODO: Should we return an error if any of the ids are not found?
        let types: Vec<MessageType> = request_type.into();
        ids.into_iter()
            .flat_map(|id| {
                let request_time = request_time.clone();
                types.iter().map(move |message_type| {
                    let key = MessageKey {
                        id,
                        type_: message_type.clone(),
                    };
                    self.retrieve_message_state(key, request_time.clone())
                        .ok_or(anyhow!("Message not found"))
                })
            })
            .collect()
    }

    fn keys(&self) -> Vec<MessageKey> {
        self.cache.iter().map(|entry| entry.key().clone()).collect()
    }
}
