//! Base Prometheus metrics shared by all pushers.

use anyhow::Result;
use prometheus::{CounterVec, Gauge, Opts, Registry};
use std::net::SocketAddr;

#[derive(Clone)]
pub struct BaseMetrics {
    pub lazer_updates_received: CounterVec,
    pub batch_size: Gauge,
    pub last_push_timestamp: Gauge,
}

impl BaseMetrics {
    #[allow(
        clippy::expect_used,
        reason = "metric creation with static strings cannot fail"
    )]
    pub fn new(prefix: &str) -> Self {
        Self {
            lazer_updates_received: CounterVec::new(
                Opts::new(
                    format!("{prefix}lazer_updates_received_total"),
                    "Price updates received from Lazer",
                ),
                &["feed_id"],
            )
            .expect("failed to create metric"),

            batch_size: Gauge::new(format!("{prefix}batch_size"), "Feeds in last pushed batch")
                .expect("failed to create metric"),

            last_push_timestamp: Gauge::new(
                format!("{prefix}last_push_timestamp_seconds"),
                "Last successful push timestamp",
            )
            .expect("failed to create metric"),
        }
    }

    pub fn register(&self, registry: &Registry) -> Result<()> {
        registry.register(Box::new(self.lazer_updates_received.clone()))?;
        registry.register(Box::new(self.batch_size.clone()))?;
        registry.register(Box::new(self.last_push_timestamp.clone()))?;
        Ok(())
    }

    pub fn record_lazer_update(&self, feed_id: u32) {
        self.lazer_updates_received
            .with_label_values(&[&feed_id.to_string()])
            .inc();
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

pub fn init_prometheus_exporter(address: SocketAddr) -> Result<()> {
    prometheus_exporter::start(address)?;
    Ok(())
}
