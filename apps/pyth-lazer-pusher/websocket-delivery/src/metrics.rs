//! WebSocket delivery metrics.

use prometheus::{Counter, CounterVec, Gauge, GaugeVec, Histogram, HistogramOpts, Opts, Registry};
use std::collections::HashMap;

#[derive(Clone)]
pub struct DeliveryMetrics {
    pub messages_sent: CounterVec,
    pub connections_active: Gauge,
    pub connection_state: GaugeVec,
    pub reconnect_attempts: Counter,
    pub ping_latency: Histogram,
    pub ping_timeouts: Counter,
}

impl DeliveryMetrics {
    #[allow(
        clippy::expect_used,
        reason = "metric creation with static strings cannot fail"
    )]
    pub fn new(pusher: &str) -> Self {
        let const_labels: HashMap<String, String> =
            [("pusher".to_string(), pusher.to_string())].into();

        Self {
            messages_sent: CounterVec::new(
                Opts::new("ws_messages_sent_total", "WebSocket messages sent")
                    .const_labels(const_labels.clone()),
                &["status"],
            )
            .expect("failed to create metric"),

            connections_active: Gauge::with_opts(
                Opts::new("ws_connections_active", "Connected endpoints")
                    .const_labels(const_labels.clone()),
            )
            .expect("failed to create metric"),

            connection_state: GaugeVec::new(
                Opts::new("ws_connection_state", "Connection state (1=up, 0=down)")
                    .const_labels(const_labels.clone()),
                &["endpoint"],
            )
            .expect("failed to create metric"),

            reconnect_attempts: Counter::with_opts(
                Opts::new("ws_reconnect_attempts_total", "Reconnection attempts")
                    .const_labels(const_labels.clone()),
            )
            .expect("failed to create metric"),

            ping_latency: Histogram::with_opts(
                HistogramOpts::new("ws_ping_latency_seconds", "Ping round-trip latency")
                    .const_labels(const_labels.clone())
                    .buckets(vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]),
            )
            .expect("failed to create metric"),

            ping_timeouts: Counter::with_opts(
                Opts::new("ws_ping_timeouts_total", "Ping timeouts").const_labels(const_labels),
            )
            .expect("failed to create metric"),
        }
    }

    pub fn register(&self, registry: &Registry) -> Result<(), prometheus::Error> {
        registry.register(Box::new(self.messages_sent.clone()))?;
        registry.register(Box::new(self.connections_active.clone()))?;
        registry.register(Box::new(self.connection_state.clone()))?;
        registry.register(Box::new(self.reconnect_attempts.clone()))?;
        registry.register(Box::new(self.ping_latency.clone()))?;
        registry.register(Box::new(self.ping_timeouts.clone()))?;
        Ok(())
    }

    pub fn record_success(&self) {
        self.messages_sent.with_label_values(&["success"]).inc();
    }

    pub fn record_failure(&self, status: &str) {
        self.messages_sent.with_label_values(&[status]).inc();
    }

    pub fn set_connection_state(&self, endpoint: &str, connected: bool) {
        self.connection_state
            .with_label_values(&[endpoint])
            .set(if connected { 1.0 } else { 0.0 });
    }

    #[allow(clippy::cast_precision_loss, reason = "connection count fits in f64")]
    pub fn set_connections_active(&self, count: usize) {
        self.connections_active.set(count as f64);
    }

    pub fn record_reconnect_attempt(&self) {
        self.reconnect_attempts.inc();
    }

    pub fn record_ping_latency(&self, latency_secs: f64) {
        self.ping_latency.observe(latency_secs);
    }

    pub fn record_ping_timeout(&self) {
        self.ping_timeouts.inc();
    }
}
