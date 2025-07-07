//! This module contains the global state of the application.

use {
    self::{
        aggregate::{AggregateState, AggregationEvent},
        benchmarks::BenchmarksState,
        cache::CacheState,
        metrics::MetricsState,
        price_feeds_metadata::PriceFeedMetaState,
        wormhole::WormholeState,
    },
    aggregate::Slot,
    prometheus_client::registry::Registry,
    reqwest::Url,
    std::{sync::Arc, time::Duration},
    tokio::sync::broadcast::Sender,
};

pub mod aggregate;
pub mod benchmarks;
pub mod cache;
pub mod metrics;
pub mod price_feeds_metadata;
pub mod wormhole;

// Expose State interfaces and types for other modules.
pub use {
    aggregate::Aggregates, benchmarks::Benchmarks, cache::Cache, metrics::Metrics,
    price_feeds_metadata::PriceFeedMeta, wormhole::Wormhole,
};

/// State contains all relevant shared application state.
///
/// This type is intentionally not exposed, forcing modules to interface with the
/// various API's using the provided traits. This is done to enforce separation of
/// concerns and to avoid direct manipulation of state.
struct State {
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

pub fn new(
    update_tx: Sender<AggregationEvent>,
    cache_size: usize,
    benchmarks_endpoint: Option<Url>,
    readiness_staleness_threshold: Duration,
    readiness_max_allowed_slot_lag: Slot,
) -> Arc<impl Metrics + Wormhole> {
    let mut metrics_registry = Registry::default();
    Arc::new(State {
        cache: CacheState::new(cache_size),
        benchmarks: BenchmarksState::new(benchmarks_endpoint),
        price_feed_meta: PriceFeedMetaState::new(),
        aggregates: AggregateState::new(
            update_tx,
            readiness_staleness_threshold,
            readiness_max_allowed_slot_lag,
            &mut metrics_registry,
        ),
        wormhole: WormholeState::new(),
        metrics: MetricsState::new(metrics_registry),
    })
}

#[cfg(test)]
pub mod test {
    use {
        super::{aggregate::AggregationEvent, Aggregates, Wormhole},
        crate::network::wormhole::GuardianSet,
        std::{sync::Arc, time::Duration},
        tokio::sync::broadcast::Receiver,
    };

    pub async fn setup_state(
        cache_size: usize,
    ) -> (Arc<impl Aggregates>, Receiver<AggregationEvent>) {
        let (update_tx, update_rx) = tokio::sync::broadcast::channel(1000);
        let state = super::new(update_tx, cache_size, None, Duration::from_secs(30), 10);

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
