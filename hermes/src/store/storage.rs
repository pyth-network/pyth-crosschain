use {
    super::{
        RequestTime,
        StorageData,
        UnixTimestamp,
    },
    anyhow::Result,
    derive_more::{
        Deref,
        DerefMut,
    },
};

pub mod local_cache;

#[derive(Clone, PartialEq, Eq, Debug, Hash, Deref, DerefMut)]
pub struct Key(Vec<u8>);

impl Key {
    pub fn new(key: Vec<u8>) -> Self {
        Self(key)
    }
}

/// This trait defines the interface for a Proof Storage
///
/// Price proofs for Pyth can come in multiple formats, for example VAA's and
/// Merkle proofs. The abstraction therefore allows storing these as binary
/// data to abstract the details of the proof data, and so each proof is stored
/// under a separate key. The caller is responsible for specifying the right
/// key for the proof data they wish to access.
pub trait Storage: Sync + Send {
    fn insert(&self, key: Key, time: UnixTimestamp, value: StorageData) -> Result<()>;
    fn get(&self, key: Key, request_time: RequestTime) -> Result<Option<StorageData>>;
}
