use {
    super::{
        BackendData,
        RequestTime,
        UnixTimestamp,
    },
    anyhow::Result,
    std::{
        ops::{
            Deref,
            DerefMut,
        },
        sync::Arc,
    },
};

pub mod local_cache;

#[derive(Clone, PartialEq, Eq, Debug, Hash)]
pub struct Key(Vec<u8>);

impl Key {
    pub fn new(key: Vec<u8>) -> Self {
        Self(key)
    }
}

impl Deref for Key {
    type Target = Vec<u8>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Key {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
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
    fn insert(&self, key: Key, time: UnixTimestamp, value: BackendData) -> Result<()>;
    fn get(&self, key: Key, request_time: RequestTime) -> Result<Option<BackendData>>;
}

pub type Backend = Arc<Box<dyn Storage>>;
