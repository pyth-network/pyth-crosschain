//! This module contains the global state of the application.

use {
    self::{
        aggregate::{
            AggregateState,
            AggregationEvent,
        },
        benchmarks::BenchmarksState,
        cache::CacheState,
        metrics::MetricsState,
        wormhole::WormholeState,
    },
    crate::price_feeds_metadata::PriceFeedMetaState,
    prometheus_client::registry::Registry,
    reqwest::Url,
    std::sync::Arc,
    tokio::sync::broadcast::Sender,
};

pub mod aggregate;
pub mod benchmarks;
pub mod cache;
pub mod metrics;
pub mod wormhole;

pub struct State {
    /// State for the `Cache` service for short-lived storage of updates.
    pub cache: CacheState,

    /// State for the `Benchmarks` service for looking up historical updates.
    pub benchmarks: BenchmarksState,

    /// State for the `PriceFeedMeta` service for looking up metadata related to Pyth price feeds.
    pub price_feed_meta: PriceFeedMetaState,

    /// State for accessing/storing Pyth price aggregates.
    pub aggregates: AggregateState,

    /// State for tracking wormhole state when reading VAAs.
    pub wormhole: WormholeState,

    /// Metrics registry for tracking process metrics and timings.
    pub metrics: MetricsState,
}

impl State {
    pub fn new(
        update_tx: Sender<AggregationEvent>,
        cache_size: u64,
        benchmarks_endpoint: Option<Url>,
    ) -> Arc<Self> {
        let mut metrics_registry = Registry::default();
        Arc::new(Self {
            cache:           CacheState::new(cache_size),
            benchmarks:      BenchmarksState::new(benchmarks_endpoint),
            price_feed_meta: PriceFeedMetaState::new(),
            aggregates:      AggregateState::new(update_tx, &mut metrics_registry),
            wormhole:        WormholeState::new(),
            metrics:         MetricsState::new(metrics_registry),
        })
    }
}

#[cfg(test)]
pub mod test {
    use {
        self::wormhole::Wormhole,
        super::*,
        crate::network::wormhole::GuardianSet,
        tokio::sync::broadcast::Receiver,
    };

    pub async fn setup_state(cache_size: u64) -> (Arc<State>, Receiver<AggregationEvent>) {
        let (update_tx, update_rx) = tokio::sync::broadcast::channel(1000);
        let state = State::new(update_tx, cache_size, None);

        // Add an initial guardian set with public key 0
        Wormhole::update_guardian_set(
            &*state,
            0,
            GuardianSet {
                keys: vec![[0; 20]],
            },
        )
        .await;

        (state, update_rx)
    }
}
