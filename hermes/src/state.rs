//! This module contains the global state of the application.

use {
    self::cache::Cache,
    crate::{
        aggregate::{
            AggregateState,
            AggregationEvent,
        },
        api::types::PriceFeedMetadata,
        network::wormhole::GuardianSet,
    },
    anyhow::Result,
    prometheus_client::registry::Registry,
    reqwest::Url,
    solana_sdk::pubkey::Pubkey,
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

    /// Metrics registry
    pub metrics_registry: RwLock<Registry>,

    /// RPC HTTP endpoint
    pub rpc_http_endpoint: String,

    /// Mapping address
    pub mapping_address: Pubkey,

    /// Price feeds metadata
    pub price_feeds_metadata: RwLock<Vec<PriceFeedMetadata>>,
}

impl State {
    pub fn new(
        update_tx: Sender<AggregationEvent>,
        cache_size: u64,
        benchmarks_endpoint: Option<Url>,
        rpc_http_endpoint: String,
        mapping_address: Pubkey,
    ) -> Arc<Self> {
        let mut metrics_registry = Registry::default();
        Arc::new(Self {
            cache: Cache::new(cache_size),
            observed_vaa_seqs: RwLock::new(Default::default()),
            guardian_set: RwLock::new(Default::default()),
            api_update_tx: update_tx,
            aggregate_state: RwLock::new(AggregateState::new(&mut metrics_registry)),
            benchmarks_endpoint,
            metrics_registry: RwLock::new(metrics_registry),
            rpc_http_endpoint,
            mapping_address,
            price_feeds_metadata: RwLock::new(Default::default()),
        })
    }
}

pub async fn retrieve_price_feeds_metadata(state: &State) -> Result<Vec<PriceFeedMetadata>> {
    let price_feeds_metadata = state.price_feeds_metadata.read().await;
    Ok(price_feeds_metadata.clone())
}

pub async fn store_price_feeds_metadata(
    state: &State,
    price_feeds_metadata: &[PriceFeedMetadata],
) -> Result<()> {
    let mut price_feeds_metadata_write_guard = state.price_feeds_metadata.write().await;
    *price_feeds_metadata_write_guard = price_feeds_metadata.to_vec();
    Ok(())
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
        let state = State::new(
            update_tx,
            cache_size,
            None,
            "".to_string(),
            Pubkey::default(),
        );

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
