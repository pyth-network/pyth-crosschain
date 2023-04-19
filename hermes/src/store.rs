use {
    self::{
        proof::batch_vaa::PriceInfosWithUpdateData,
        storage::Storage,
    },
    anyhow::Result,
    pyth_sdk::PriceIdentifier,
    std::sync::Arc,
};

pub mod proof;
pub mod storage;

pub type UnixTimestamp = u64;

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum RequestTime {
    Latest,
    FirstAfter(UnixTimestamp),
}

pub enum Update {
    Vaa(Vec<u8>),
}

pub struct PriceFeedsWithUpdateData {
    pub batch_vaa: PriceInfosWithUpdateData,
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

    /// Stores the update data in the store and returns the price identifiers for which
    /// price feeds were updated.
    pub fn store_update(&self, update: Update) -> Result<Vec<PriceIdentifier>> {
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
        Ok(PriceFeedsWithUpdateData {
            batch_vaa: proof::batch_vaa::get_price_infos_with_update_data(
                self.state.clone(),
                price_ids,
                request_time,
            )?,
        })
    }

    pub fn get_price_feed_ids(&self) -> Vec<PriceIdentifier> {
        proof::batch_vaa::get_price_feed_ids(self.state.clone())
    }
}
