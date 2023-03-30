use {
    self::{
        proof::batch_vaa::PriceInfo,
        storage::Storage,
    },
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

#[derive(Clone, PartialEq, Debug)]
pub enum StorageData {
    BatchVaa(PriceInfo),
}

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Proof {
    pub batch_vaa: Vec<Vec<u8>>,
}

#[derive(Clone, Default)]
pub struct PriceFeedsWithProof {
    pub price_feeds: HashMap<PriceIdentifier, PriceFeed>,
    pub proof:       Proof,
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
        proof::batch_vaa::store_update(self.state.clone(), update)
    }

    pub fn get_price_feeds_with_proof(
        &self,
        price_ids: Vec<PriceIdentifier>,
        request_time: RequestTime,
    ) -> Result<PriceFeedsWithProof> {
        proof::batch_vaa::get_price_feeds_with_proofs(self.state.clone(), price_ids, request_time)
    }
}
