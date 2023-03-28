use anyhow::Result;

pub mod local_cache;

pub type UnixTimestamp = u64;

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct DbRecord {
    pub time:  UnixTimestamp,
    pub value: Vec<u8>,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum RequestTime {
    Latest,
    FirstAfter(UnixTimestamp),
}

/// This trait defines the interface for a Proof Storage
///
/// Price proofs for Pyth can come in multiple formats, for example VAA's and
/// Merkle proofs. The abstraction therefore allows storing these as binary
/// data to abstract the details of the proof data, and so each proof is stored
/// under a separate key. The caller is responsible for specifying the right
/// key for the proof data they wish to access.
pub trait Db: Clone + Sync + Send {
    fn insert(&mut self, key: &[u8], record: DbRecord) -> Result<()>;
    fn get(&self, key: &[u8], request_time: RequestTime) -> Result<Option<Vec<u8>>>;
}
