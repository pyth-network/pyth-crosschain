use {
    super::{
        super::RequestTime,
        Key,
        StoreBackend,
        UnixTimestamp,
    },
    crate::store::BackendData,
    anyhow::Result,
    dashmap::DashMap,
    std::{
        collections::VecDeque,
        sync::Arc,
    },
};

#[derive(Clone, PartialEq, Debug)]
pub struct Record {
    pub time:  UnixTimestamp,
    pub value: BackendData,
}

#[derive(Clone)]
pub struct LocalCache {
    cache:            Arc<DashMap<Key, VecDeque<Record>>>,
    max_size_per_key: usize,
}

impl LocalCache {
    pub fn new(max_size_per_key: usize) -> Self {
        Self {
            cache: Arc::new(DashMap::new()),
            max_size_per_key,
        }
    }
}

impl StoreBackend for LocalCache {
    /// Add a new db entry to the cache.
    ///
    /// This method keeps the backed store sorted for efficiency, and removes
    /// the oldest record in the cache if the max_size is reached. Entries are
    /// usually added in increasing order and likely to be inserted near the
    /// end of the deque. The function is optimized for this specific case.
    fn insert(&self, key: Key, time: UnixTimestamp, value: BackendData) -> Result<()> {
        let mut key_cache = self.cache.entry(key).or_insert_with(VecDeque::new);

        let record = Record { time, value };

        key_cache.push_back(record);

        // Shift the pushed record until it's in the right place.
        let mut i = key_cache.len() - 1;
        while i > 0 && key_cache[i - 1].time > key_cache[i].time {
            key_cache.swap(i - 1, i);
            i -= 1;
        }

        // Remove the oldest record if the max size is reached.
        if key_cache.len() > self.max_size_per_key {
            key_cache.pop_front();
        }

        Ok(())
    }

    fn get(&self, key: Key, request_time: RequestTime) -> Result<Option<BackendData>> {
        match self.cache.get(&key) {
            Some(key_cache) => {
                let record = match request_time {
                    RequestTime::Latest => key_cache.back().cloned(),
                    RequestTime::FirstAfter(time) => {
                        // If the requested time is before the first element in the vector, we are
                        // not sure that the first element is the closest one.
                        if let Some(oldest_record) = key_cache.front() {
                            if time < oldest_record.time {
                                return Ok(None);
                            }
                        }

                        // Binary search returns Ok(idx) if the element is found at index idx or Err(idx) if it's not found which idx
                        // is the index where the element should be inserted to keep the vector sorted. Getting idx within any of
                        // the match arms will give us the index of the element that is closest after or equal to the requested time.
                        let idx = match key_cache.binary_search_by_key(&time, |record| record.time)
                        {
                            Ok(idx) => idx,
                            Err(idx) => idx,
                        };

                        // We are using `get` to handle out of bound idx. This happens if the
                        // requested time is after the last element in the vector.
                        key_cache.get(idx).cloned()
                    }
                };

                Ok(record.map(|record| record.value))
            }
            None => Ok(None),
        }
    }
}
