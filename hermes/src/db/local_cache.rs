use {
    super::{
        Db,
        DbRecord,
        RequestTime,
    },
    anyhow::Result,
    dashmap::DashMap,
    std::{
        collections::VecDeque,
        sync::Arc,
    },
};

#[derive(Clone)]
pub struct LocalCache {
    cache:            Arc<DashMap<Vec<u8>, VecDeque<DbRecord>>>,
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

impl Db for LocalCache {
    /// Add a new db record to the deque for the key while keeping it sorted.
    /// This function also removes the oldest record in the cache if the max_size is reached.
    /// Records are usually added in increasing order and the function is optimized for that case.
    fn insert(&mut self, key: &[u8], record: DbRecord) -> Result<()> {
        let mut key_cache = self.cache.entry(key.to_vec()).or_insert_with(VecDeque::new);

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

    fn get(&self, key: &[u8], request_time: RequestTime) -> Result<Option<Vec<u8>>> {
        match self.cache.get(key) {
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
