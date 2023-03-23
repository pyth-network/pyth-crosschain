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

/// This trait defines the interface for a database. The design can support both current
/// batch-based attestation and future attestation based on accumulators. A accumulated
/// data contains all the state at a single timestamp; but as we will probably have different
/// accumulators, we store each data on a separate key. The data is defined as a binary
/// to abstract away the details of the proof data.
pub trait Db: Clone + Sync + Send {
    fn insert(&mut self, key: &[u8], record: DbRecord) -> Result<()>;
    fn get(&self, key: &[u8], request_time: RequestTime) -> Result<Option<Vec<u8>>>;
}
