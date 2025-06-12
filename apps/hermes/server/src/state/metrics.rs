use {
    super::State,
    prometheus_client::{
        encoding::text::encode,
        registry::{Metric, Registry},
    },
    tokio::sync::RwLock,
};

pub struct MetricsState {
    /// Metrics registry, allows interfacing with backends.
    pub registry: RwLock<Registry>,
}

impl MetricsState {
    pub fn new(metrics_registry: Registry) -> Self {
        Self {
            registry: RwLock::new(metrics_registry),
        }
    }
}

/// Allow downcasting State into MetricsState for functions that depend on the `Metrics` service.
impl<'a> From<&'a State> for &'a MetricsState {
    fn from(state: &'a State) -> &'a MetricsState {
        &state.metrics
    }
}

#[async_trait::async_trait]
pub trait Metrics {
    async fn register(&self, metric: (&str, &str, impl Metric));
    async fn encode(&self) -> String;
}

#[async_trait::async_trait]
impl<T> Metrics for T
where
    for<'a> &'a T: Into<&'a MetricsState>,
    T: Sync,
{
    async fn register(&self, metric: (&str, &str, impl Metric)) {
        self.into()
            .registry
            .write()
            .await
            .register(metric.0, metric.1, metric.2);
    }

    /// Encode known Metrics in OpenTelemetry format.
    async fn encode(&self) -> String {
        let registry = self.into().registry.read().await;
        let mut buffer = String::new();
        if let Err(err) = encode(&mut buffer, &registry) {
            tracing::error!("failed to encode metrics: {err}");
            return String::new();
        }
        buffer
    }
}
