#[cfg(test)]
use mock_instant::{
    Instant,
    SystemTime,
    UNIX_EPOCH,
};
#[cfg(not(test))]
use std::time::Instant;
use {
    self::cache::Cache,
    crate::aggregate::wormhole::GuardianSet,
    reqwest::Url,
    std::{
        collections::{
            BTreeMap,
            BTreeSet,
        },
        sync::Arc,
    },
    tokio::sync::{
        mpsc::Sender,
        RwLock,
    },
};

pub mod benchmarks;
pub mod cache;

pub struct State {
    /// Storage is a short-lived cache of the state of all the updates that have been passed to the
    /// store.
    pub cache: Cache,

    /// Sequence numbers of lately observed Vaas. Store uses this set
    /// to ignore the previously observed Vaas as a performance boost.
    pub observed_vaa_seqs: RwLock<BTreeSet<u64>>,

    /// Wormhole guardian sets. It is used to verify Vaas before using them.
    pub guardian_set: RwLock<BTreeMap<u32, GuardianSet>>,

    /// The sender to the channel between Store and Api to notify completed updates.
    pub update_tx: Sender<()>,

    /// Time of the last completed update. This is used for the health probes.
    pub last_completed_update_at: RwLock<Option<Instant>>,

    /// Benchmarks endpoint
    pub benchmarks_endpoint: Option<Url>,
}

impl State {
    pub fn new(
        update_tx: Sender<()>,
        cache_size: u64,
        benchmarks_endpoint: Option<Url>,
    ) -> Arc<Self> {
        Arc::new(Self {
            cache: Cache::new(cache_size),
            observed_vaa_seqs: RwLock::new(Default::default()),
            guardian_set: RwLock::new(Default::default()),
            update_tx,
            last_completed_update_at: RwLock::new(None),
            benchmarks_endpoint,
        })
    }
}
