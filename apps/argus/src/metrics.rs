use {
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{counter::Counter, family::Family, gauge::Gauge},
        registry::Registry,
    },
    std::sync::Arc,
    tokio::sync::RwLock,
};

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct SubscriptionLabel {
    pub subscription_id: String,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct ChainLabel {
    pub chain_id: String,
}

pub struct ControllerMetrics {
    registry: Arc<RwLock<Registry>>,
    update_success_counter: Family<SubscriptionLabel, Counter>,
    update_failure_counter: Family<SubscriptionLabel, Counter>,
}

impl ControllerMetrics {
    pub async fn new(registry: Arc<RwLock<Registry>>, chain_id: String) -> Self {
        let update_success_counter = Family::<SubscriptionLabel, Counter>::default();
        let update_failure_counter = Family::<SubscriptionLabel, Counter>::default();
        
        registry.write().await.register(
            format!("controller_{}_update_success", chain_id),
            "Number of successful price updates per subscription",
            update_success_counter.clone(),
        );
        
        registry.write().await.register(
            format!("controller_{}_update_failure", chain_id),
            "Number of failed price updates per subscription",
            update_failure_counter.clone(),
        );
        
        Self {
            registry,
            update_success_counter,
            update_failure_counter,
        }
    }

    pub fn record_update_success(&self, subscription_id: u64) {
        self.update_success_counter
            .get_or_create(&SubscriptionLabel {
                subscription_id: subscription_id.to_string(),
            })
            .inc();
    }

    pub fn record_update_failure(&self, subscription_id: u64) {
        self.update_failure_counter
            .get_or_create(&SubscriptionLabel {
                subscription_id: subscription_id.to_string(),
            })
            .inc();
    }
}

pub struct PricePusherMetrics {
    registry: Arc<RwLock<Registry>>,
    success_counter: Counter,
    failure_counter: Counter,
    gas_used_gauge: Gauge,
}

impl PricePusherMetrics {
    pub async fn new(registry: Arc<RwLock<Registry>>, chain_id: String) -> Self {
        let success_counter = Counter::default();
        let failure_counter = Counter::default();
        let gas_used_gauge = Gauge::default();
        
        registry.write().await.register(
            format!("price_pusher_{}_success", chain_id),
            "Number of successful price pushes",
            success_counter.clone(),
        );
        
        registry.write().await.register(
            format!("price_pusher_{}_failure", chain_id),
            "Number of failed price pushes",
            failure_counter.clone(),
        );
        
        registry.write().await.register(
            format!("price_pusher_{}_gas_used", chain_id),
            "Gas used for price pushes",
            gas_used_gauge.clone(),
        );
        
        Self {
            registry,
            success_counter,
            failure_counter,
            gas_used_gauge,
        }
    }

    pub fn record_success(&self) {
        self.success_counter.inc();
    }

    pub fn record_failure(&self) {
        self.failure_counter.inc();
    }

    pub fn record_gas_used(&self, gas_used: u64) {
        self.gas_used_gauge.set(gas_used as i64);
    }
}
