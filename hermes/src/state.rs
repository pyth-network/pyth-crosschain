//! This module contains the global state of the application.

use {
    self::cache::Cache,
    crate::{
        aggregate::{
            AggregateState,
            AggregationEvent,
        },
        network::wormhole::GuardianSet,
    },
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
    pub api_update_tx: Sender<AggregationEvent>,

    /// The aggregate module state.
    pub aggregate_state: RwLock<AggregateState>,

    /// Benchmarks endpoint
    pub benchmarks_endpoint: Option<Url>,
}

impl State {
    pub fn new(
        update_tx: Sender<AggregationEvent>,
        cache_size: u64,
        benchmarks_endpoint: Option<Url>,
    ) -> Arc<Self> {
        Arc::new(Self {
            cache: Cache::new(cache_size),
            observed_vaa_seqs: RwLock::new(Default::default()),
            guardian_set: RwLock::new(Default::default()),
            api_update_tx: update_tx,
            aggregate_state: RwLock::new(AggregateState::new()),
            benchmarks_endpoint,
        })
    }
}

#[cfg(test)]
pub mod test {
    use {
        super::*,
        crate::network::wormhole::update_guardian_set,
        tokio::sync::mpsc::Receiver,
    };

    pub async fn setup_state(cache_size: u64) -> (Arc<State>, Receiver<AggregationEvent>) {
        let (update_tx, update_rx) = tokio::sync::mpsc::channel(1000);
        let state = State::new(update_tx, cache_size, None);

        // Add an initial guardian set with public key 0
        update_guardian_set(
            &state,
            0,
            GuardianSet {
                keys: vec![[0; 20]],
            },
        )
        .await;

        (state, update_rx)
    }
}
