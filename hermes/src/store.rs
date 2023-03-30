use {
    self::storage::Storage,
    anyhow::Result,
    pyth_sdk::{
        PriceFeed,
        PriceIdentifier,
    },
    serde::{
        Deserialize,
        Serialize,
    },
    std::{
        collections::HashMap,
        sync::Arc,
    },
};

mod proof;
mod storage;

pub type UnixTimestamp = u64;

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum RequestTime {
    Latest,
    FirstAfter(UnixTimestamp),
}

pub enum Update {
    Vaa(Vec<u8>),
}

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct UpdateData {
    pub batch_vaa: Vec<Vec<u8>>,
}

// TODO: A price feed might not have update data in all different
// formats. For example, Batch VAA and Merkle updates will result
// in different price feeds. We need to figure out how to handle
// it properly.
#[derive(Clone, Default)]
pub struct PriceFeedsWithUpdateData {
    pub price_feeds: HashMap<PriceIdentifier, PriceFeed>,
    pub update_data: UpdateData,
}

pub type State = Arc<Box<dyn Storage>>;

#[derive(Clone)]
pub struct Store {
    pub state: State,
}

impl Store {
    pub fn new_with_local_cache(max_size_per_key: usize) -> Self {
        Self {
            state: Arc::new(Box::new(storage::local_cache::LocalCache::new(
                max_size_per_key,
            ))),
        }
    }

    // TODO: This should return the updated feeds so the subscribers can be notified.
    pub fn store_update(&self, update: Update) -> Result<()> {
        match update {
            Update::Vaa(vaa_bytes) => {
                proof::batch_vaa::store_vaa_update(self.state.clone(), vaa_bytes)
            }
        }
    }

    pub fn get_price_feeds_with_update_data(
        &self,
        price_ids: Vec<PriceIdentifier>,
        request_time: RequestTime,
    ) -> Result<PriceFeedsWithUpdateData> {
        proof::batch_vaa::get_price_feeds_with_update_data(
            self.state.clone(),
            price_ids,
            request_time,
        )
    }
}
