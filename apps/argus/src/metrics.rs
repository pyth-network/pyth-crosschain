use {
    crate::state::ChainName,
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{counter::Counter, family::Family, gauge::Gauge, histogram::Histogram},
        registry::Registry,
    },
    std::sync::{atomic::AtomicU64, Arc},
    tokio::sync::RwLock,
};

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct ChainNameLabel {
    pub chain_name: ChainName,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct SubscriptionIdLabel {
    pub chain_name: ChainName,
    pub subscription_id: String,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct PriceFeedIdLabel {
    pub chain_name: ChainName,
    pub price_feed_id: String,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct KeeperIdLabel {
    pub chain_name: ChainName,
    pub keeper_id: String,
}

pub struct KeeperMetrics {
    /// Number of active subscriptions per chain
    pub active_subscriptions: Family<ChainNameLabel, Gauge>,
    /// Number of price feeds per chain that are in an active subscription
    pub active_price_feeds: Family<ChainNameLabel, Gauge>,
    /// Last published time for an active price feed (Unix timestamp seconds)
    pub last_published_time_s: Family<PriceFeedIdLabel, Gauge<f64, AtomicU64>>,
    /// Total gas fee (in native token) spent on price updates per chain
    pub total_gas_fee_spent: Family<ChainNameLabel, Gauge<f64, AtomicU64>>,
    /// Total payment received (in native token) per chain
    pub total_payment_received: Family<ChainNameLabel, Gauge<f64, AtomicU64>>,
    /// Number of successful price updates per chain
    pub successful_price_updates: Family<ChainNameLabel, Counter>,
    /// Number of failed price updates per chain
    pub failed_price_updates: Family<ChainNameLabel, Counter>,
    /// Current gas price estimate (in Gwei) per chain
    pub gas_price_estimate: Family<ChainNameLabel, Gauge<f64, AtomicU64>>,
    /// Keeper wallet balance (in native token) per chain
    pub keeper_wallet_balance: Family<KeeperIdLabel, Gauge<f64, AtomicU64>>,
    /// Duration from the time the keeper notices an eligible update criteria to the time the keeper lands the update on-chain in milliseconds per chain
    pub price_update_latency_ms: Family<PriceFeedIdLabel, Histogram>,
}

impl Default for KeeperMetrics {
    fn default() -> Self {
        Self {
            active_subscriptions: Family::default(),
            active_price_feeds: Family::default(),
            last_published_time_s: Family::default(),
            total_gas_fee_spent: Family::default(),
            total_payment_received: Family::default(),
            successful_price_updates: Family::default(),
            failed_price_updates: Family::default(),
            gas_price_estimate: Family::default(),
            keeper_wallet_balance: Family::default(),
            price_update_latency_ms: Family::new_with_constructor(|| {
                Histogram::new(
                    vec![
                        100.0, 250.0, 500.0, 1000.0, 2500.0, 5000.0, 10000.0, 20000.0, 30000.0,
                        60000.0,
                    ]
                    .into_iter(),
                )
            }),
        }
    }
}

impl KeeperMetrics {
    pub async fn new(registry: Arc<RwLock<Registry>>, chain_names: Vec<String>) -> Self {
        let mut writable_registry = registry.write().await;
        let keeper_metrics = KeeperMetrics::default();

        writable_registry.register(
            "active_subscriptions",
            "Number of active subscriptions per chain",
            keeper_metrics.active_subscriptions.clone(),
        );

        writable_registry.register(
            "active_price_feeds",
            "Number of active price feeds per chain",
            keeper_metrics.active_price_feeds.clone(),
        );

        writable_registry.register(
            "last_published_time_s",
            "Last published time for an active price feed (Unix timestamp seconds)",
            keeper_metrics.last_published_time_s.clone(),
        );

        writable_registry.register(
            "total_gas_fee_spent",
            "Total gas fee (in native token) spent on price updates per chain",
            keeper_metrics.total_gas_fee_spent.clone(),
        );

        writable_registry.register(
            "total_payment_received",
            "Total payment received (in native token) per chain",
            keeper_metrics.total_payment_received.clone(),
        );

        writable_registry.register(
            "successful_price_updates",
            "Number of successful price updates per chain",
            keeper_metrics.successful_price_updates.clone(),
        );

        writable_registry.register(
            "failed_price_updates",
            "Number of failed price updates per chain",
            keeper_metrics.failed_price_updates.clone(),
        );

        writable_registry.register(
            "gas_price_estimate",
            "Current gas price estimate (in Gwei) per chain",
            keeper_metrics.gas_price_estimate.clone(),
        );

        writable_registry.register(
            "keeper_wallet_balance",
            "Wallet balance (in native token) per keeper",
            keeper_metrics.keeper_wallet_balance.clone(),
        );

        writable_registry.register(
            "price_update_latency_ms",
            "Duration from the time the keeper notices an eligible update criteria to the time the keeper lands the update on-chain in milliseconds per chain",
            keeper_metrics.price_update_latency_ms.clone(),
        );

        // Initialize metrics for each chain_id
        for chain_name in chain_names {
            let chain_label = ChainNameLabel { chain_name };

            let _ = keeper_metrics
                .active_subscriptions
                .get_or_create(&chain_label);
            let _ = keeper_metrics
                .active_price_feeds
                .get_or_create(&chain_label);
            let _ = keeper_metrics
                .total_gas_fee_spent
                .get_or_create(&chain_label);
            let _ = keeper_metrics
                .total_payment_received
                .get_or_create(&chain_label);
            let _ = keeper_metrics
                .successful_price_updates
                .get_or_create(&chain_label);
            let _ = keeper_metrics
                .failed_price_updates
                .get_or_create(&chain_label);
            let _ = keeper_metrics
                .gas_price_estimate
                .get_or_create(&chain_label);
            // Note: Metrics labeled by KeeperIdLabel or PriceFeedIdLabel (keeper_wallet_balance,
            // last_published_time_s, price_update_latency_ms) are created dynamically
            // when their respective identifiers become known.
        }

        keeper_metrics
    }
}
