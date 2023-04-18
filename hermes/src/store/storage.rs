use {
    super::{
        proof::batch_vaa::PriceInfo,
        RequestTime,
        UnixTimestamp,
    },
    anyhow::Result,
    derive_more::{
        Deref,
        DerefMut,
    },
    pyth_sdk::PriceIdentifier,
};

pub mod local_cache;

#[derive(Clone, PartialEq, Debug)]
pub enum StorageData {
    BatchVaa(PriceInfo),
}

#[derive(Clone, PartialEq, Eq, Debug, Hash)]
pub enum Key {
    BatchVaa(PriceIdentifier),
}

/// This trait defines the interface for update data storage
///
/// Price update data for Pyth can come in multiple formats, for example VAA's and
/// Merkle proofs. The abstraction therefore allows storing these as binary
/// data to abstract the details of the update data, and so each update data is stored
/// under a separate key. The caller is responsible for specifying the right
/// key for the update data they wish to access.
pub trait Storage: Sync + Send {
    fn insert(&self, key: Key, time: UnixTimestamp, value: StorageData) -> Result<()>;
    fn get(&self, key: Key, request_time: RequestTime) -> Result<Option<StorageData>>;
    fn keys(&self) -> Vec<Key>;
}
