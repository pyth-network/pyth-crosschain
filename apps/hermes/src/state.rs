//! This module contains the global state of the application.

use {
    self::{
        aggregate::{
            AggregateState,
            AggregationEvent,
        },
        benchmarks::BenchmarksState,
        cache::CacheState,
    },
    crate::{
        network::wormhole::GuardianSet,
        price_feeds_metadata::PriceFeedMetaState,
    },
    prometheus_client::registry::Registry,
    reqwest::Url,
    std::{
        collections::{
            BTreeMap,
            BTreeSet,
        },
        sync::Arc,
    },
    tokio::sync::{
        broadcast::Sender,
        RwLock,
    },
};

pub mod aggregate;
pub mod benchmarks;
pub mod cache;

pub struct State {
    /// State for the `Cache` service for short-lived storage of updates.
    pub cache: CacheState,

    /// State for the `Benchmarks` service for looking up historical updates.
    pub benchmarks: BenchmarksState,

    /// State for the `PriceFeedMeta` service for looking up metadata related to Pyth price feeds.
    pub price_feed_meta: PriceFeedMetaState,

    /// State for accessing/storing Pyth price aggregates.
    pub aggregates: AggregateState,

    /// Sequence numbers of lately observed Vaas. Store uses this set
    /// to ignore the previously observed Vaas as a performance boost.
    pub observed_vaa_seqs: RwLock<BTreeSet<u64>>,

    /// Wormhole guardian sets. It is used to verify Vaas before using them.
    pub guardian_set: RwLock<BTreeMap<u32, GuardianSet>>,

    /// Metrics registry
    pub metrics_registry: RwLock<Registry>,
}

impl State {
    pub fn new(
        update_tx: Sender<AggregationEvent>,
        cache_size: u64,
        benchmarks_endpoint: Option<Url>,
    ) -> Arc<Self> {
        let mut metrics_registry = Registry::default();
        Arc::new(Self {
            cache:             CacheState::new(cache_size),
            benchmarks:        BenchmarksState::new(benchmarks_endpoint),
            price_feed_meta:   PriceFeedMetaState::new(),
            aggregates:        AggregateState::new(update_tx, &mut metrics_registry),
            observed_vaa_seqs: RwLock::new(Default::default()),
            guardian_set:      RwLock::new(Default::default()),
            metrics_registry:  RwLock::new(metrics_registry),
        })
    }
}

#[cfg(test)]
pub mod test {
    use {
        super::*,
        crate::network::wormhole::update_guardian_set,
        tokio::sync::broadcast::Receiver,
    };

    pub async fn setup_state(cache_size: u64) -> (Arc<State>, Receiver<AggregationEvent>) {
        let (update_tx, update_rx) = tokio::sync::broadcast::channel(1000);
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
