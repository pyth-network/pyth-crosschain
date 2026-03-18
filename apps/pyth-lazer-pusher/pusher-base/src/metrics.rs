//! Base Prometheus metrics shared by all pushers.

use anyhow::Result;
use prometheus::{CounterVec, Gauge, GaugeVec, Opts, Registry};
use std::collections::HashMap;
use std::net::SocketAddr;

#[derive(Clone)]
pub struct BaseMetrics {
    pub lazer_updates_received: CounterVec,
    pub batch_size: Gauge,
    pub last_push_timestamp: Gauge,
    pub feeds_configured: Gauge,
    pub feed_last_update_timestamp: GaugeVec,
}

impl BaseMetrics {
    #[allow(
        clippy::expect_used,
        reason = "metric creation with static strings cannot fail"
    )]
    pub fn new(pusher: &str) -> Self {
        let const_labels: HashMap<String, String> =
            [("pusher".to_string(), pusher.to_string())].into();

        Self {
            lazer_updates_received: CounterVec::new(
                Opts::new(
                    "updates_received_total",
                    "Price updates received from Lazer",
                )
                .namespace("lazer_pusher")
                .const_labels(const_labels.clone()),
                &["feed_id"],
            )
            .expect("failed to create metric"),

            batch_size: Gauge::with_opts(
                Opts::new("batch_size", "Feeds in last pushed batch")
                    .namespace("lazer_pusher")
                    .const_labels(const_labels.clone()),
            )
            .expect("failed to create metric"),

            last_push_timestamp: Gauge::with_opts(
                Opts::new(
                    "last_push_timestamp_seconds",
                    "Last successful push timestamp",
                )
                .namespace("lazer_pusher")
                .const_labels(const_labels.clone()),
            )
            .expect("failed to create metric"),

            feeds_configured: Gauge::with_opts(
                Opts::new("feeds_configured", "Total feeds configured for pushing")
                    .namespace("lazer_pusher")
                    .const_labels(const_labels.clone()),
            )
            .expect("failed to create metric"),

            feed_last_update_timestamp: GaugeVec::new(
                Opts::new(
                    "feed_last_update_timestamp_seconds",
                    "Per-feed last update timestamp",
                )
                .namespace("lazer_pusher")
                .const_labels(const_labels),
                &["feed_id"],
            )
            .expect("failed to create metric"),
        }
    }

    pub fn register(&self, registry: &Registry) -> Result<()> {
        registry.register(Box::new(self.lazer_updates_received.clone()))?;
        registry.register(Box::new(self.batch_size.clone()))?;
        registry.register(Box::new(self.last_push_timestamp.clone()))?;
        registry.register(Box::new(self.feeds_configured.clone()))?;
        registry.register(Box::new(self.feed_last_update_timestamp.clone()))?;
        Ok(())
    }

    pub fn record_lazer_update(&self, feed_id: u32) {
        let feed_id_str = feed_id.to_string();
        self.lazer_updates_received
            .with_label_values(&[&feed_id_str])
            .inc();
        self.feed_last_update_timestamp
            .with_label_values(&[&feed_id_str])
            .set(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs_f64())
                    .unwrap_or(0.0),
            );
    }

    #[allow(clippy::cast_precision_loss, reason = "feed count fits in f64")]
    pub fn set_feeds_configured(&self, count: usize) {
        self.feeds_configured.set(count as f64);
    }

    #[allow(clippy::cast_precision_loss, reason = "batch size fits in f64")]
    pub fn set_batch_size(&self, size: usize) {
        self.batch_size.set(size as f64);
    }

    pub fn update_last_push_timestamp(&self) {
        self.last_push_timestamp.set(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs_f64())
                .unwrap_or(0.0),
        );
    }
}

/// Note: Metrics server doesn't support gracefull shutdown
pub fn init_prometheus_exporter(address: SocketAddr) -> Result<()> {
    prometheus_exporter::start(address)?;
    Ok(())
}
