use anyhow::Result;

pub mod local_cache;

pub type UnixTimestamp = u64;

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct DbRecord {
    pub time:  UnixTimestamp,
    pub value: Vec<u8>,
}

pub enum RequestTime {
    Latest,
    FirstAfter(UnixTimestamp),
}

pub trait Db: Clone + Sync + Send {
    fn insert(&mut self, key: &[u8], record: DbRecord) -> Result<()>;
    fn get(&self, key: &[u8], request_time: RequestTime) -> Result<Option<Vec<u8>>>;
}
