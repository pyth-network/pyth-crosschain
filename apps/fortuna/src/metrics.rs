use {
    crate::api::ChainId,
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{
            counter::Counter,
            family::Family,
            gauge::Gauge,
        },
        registry::Registry,
    },
    tokio::sync::RwLock,
};

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct RequestLabel {
    pub value: String,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct RpcLabel {
    pub chain_id: ChainId,
    pub uri:      String,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct ProviderLabel {
    pub chain_id: String,
    pub address:  String,
}

pub struct Metrics {
    pub registry: RwLock<Registry>,

    pub request_counter: Family<RequestLabel, Counter>,

    pub current_sequence_number: Family<ProviderLabel, Gauge>,
    pub end_sequence_number:     Family<ProviderLabel, Gauge>,
    // pub balance:           Family<Label, Gauge>,
    // pub balance_threshold: Family<Label, Gauge>,
    //
    // pub rpc: Family<Label, Counter>,
    //
    // pub requests:     Family<Label, Counter>,
    // pub reveal:       Family<Label, Counter>,

    // NOTE: gas_spending is not part of metrics.
    // why?
    // - it is not a value that increases or decreases over time. Not a counter or a gauge
    // - it can't fit in a histogram too. logging and then collecting it is better.
}

impl Metrics {
    pub fn new() -> Self {
        let mut metrics_registry = Registry::default();

        let http_requests = Family::<RequestLabel, Counter>::default();
        metrics_registry.register(
            // With the metric name.
            "http_requests",
            // And the metric help text.
            "Number of HTTP requests received",
            http_requests.clone(),
        );

        let current_sequence_number = Family::<ProviderLabel, Gauge>::default();
        metrics_registry.register(
            // With the metric name.
            "current_sequence_number",
            // And the metric help text.
            "The sequence number for a new request.",
            current_sequence_number.clone(),
        );

        let end_sequence_number = Family::<ProviderLabel, Gauge>::default();
        metrics_registry.register(
            // With the metric name.
            "end_sequence_number",
            // And the metric help text.
            "The sequence number for the last request.",
            end_sequence_number.clone(),
        );

        Metrics {
            registry: RwLock::new(metrics_registry),
            request_counter: http_requests,
            current_sequence_number,
            end_sequence_number,
        }
    }
}
