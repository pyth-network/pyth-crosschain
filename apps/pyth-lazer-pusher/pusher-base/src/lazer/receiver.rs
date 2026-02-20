//! Lazer price receiver that subscribes to feeds and caches prices.

use super::config::LazerConfig;
use super::feeds::{FeedRegistry, FeedsConfig};
use crate::metrics::BaseMetrics;
use crate::types::{CachedPrice, PriceCache};
use anyhow::{Context as _, Result};
use pusher_utils::AppRuntime;
use pyth_lazer_client::{stream_client::PythLazerStreamClientBuilder, ws_connection::AnyResponse};
use pyth_lazer_protocol::{
    api::{
        DeliveryFormat, JsonBinaryEncoding, SubscribeRequest, SubscriptionId, SubscriptionParams,
        SubscriptionParamsRepr, WsResponse,
    },
    PriceFeedProperty,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tracing::{debug, info, warn};

/// Lazer price receiver that manages subscriptions and caches prices.
pub struct LazerReceiver {
    /// Cache of latest prices
    price_cache: PriceCache,
    /// Feed registry for tracking subscriptions
    feed_registry: FeedRegistry,
    /// Handle to the background task processing updates
    task_handle: JoinHandle<()>,
}

impl LazerReceiver {
    /// Create a new Lazer receiver and start receiving prices.
    ///
    /// This will:
    /// 1. Connect to Lazer endpoints
    /// 2. Subscribe to configured feeds (grouped by channel)
    /// 3. Spawn a background task to process updates
    ///
    /// Returns the receiver which provides access to the price cache and feed registry.
    pub async fn start(
        lazer_config: &LazerConfig,
        feeds_config: &FeedsConfig,
        metrics: Option<&BaseMetrics>,
        runtime: AppRuntime,
    ) -> Result<Self> {
        let feed_registry = FeedRegistry::from_subscriptions(&feeds_config.subscriptions);
        if feed_registry.is_empty() {
            anyhow::bail!("no feed subscriptions configured");
        }

        info!(
            feed_count = feed_registry.len(),
            channel_count = feed_registry.channel_count(),
            "loaded feed subscriptions"
        );

        // Initialize price cache
        let price_cache: PriceCache = Arc::new(RwLock::new(HashMap::new()));

        // Initialize Lazer client
        let mut lazer_client = PythLazerStreamClientBuilder::new(lazer_config.access_token.clone())
            .with_endpoints(lazer_config.endpoints.clone())
            .with_num_connections(lazer_config.num_connections)
            .with_timeout(lazer_config.timeout)
            .build()
            .context("failed to build Lazer client")?;

        let lazer_rx = lazer_client
            .start()
            .await
            .context("failed to start Lazer client")?;

        // Subscribe to price feeds - one subscription per channel (Lazer requirement)
        let mut subscription_id = 1u64;
        for (channel, feed_ids) in feed_registry.feeds_by_channel() {
            let params_repr = SubscriptionParamsRepr {
                price_feed_ids: Some(feed_ids.clone()),
                properties: vec![
                    PriceFeedProperty::Price,
                    PriceFeedProperty::BestBidPrice,
                    PriceFeedProperty::BestAskPrice,
                    PriceFeedProperty::Exponent,
                ],
                delivery_format: DeliveryFormat::Json,
                channel: channel.to_protocol_channel(),
                parsed: true,
                symbols: None,
                formats: vec![],
                json_binary_encoding: JsonBinaryEncoding::Base64,
                ignore_invalid_feeds: false,
            };

            let subscription_request = SubscribeRequest {
                subscription_id: SubscriptionId(subscription_id),
                params: SubscriptionParams::new(params_repr)
                    .map_err(|e| anyhow::anyhow!("failed to create subscription params: {}", e))?,
            };

            lazer_client
                .subscribe(subscription_request)
                .await
                .with_context(|| format!("failed to subscribe to channel {channel}"))?;

            info!(
                %channel,
                feed_count = feed_ids.len(),
                subscription_id,
                "subscribed to Lazer channel"
            );

            subscription_id += 1;
        }

        // Clone for the spawned task
        let price_cache_clone = price_cache.clone();
        let feed_registry_clone = feed_registry.clone();
        let metrics_clone = metrics.cloned();
        let runtime_clone = runtime.clone();

        // Spawn receiver task (tracked for graceful shutdown)
        let task_handle = runtime.spawn(async move {
            process_lazer_updates(
                lazer_rx,
                price_cache_clone,
                feed_registry_clone,
                metrics_clone,
                runtime_clone,
            )
            .await;
        });

        Ok(Self {
            price_cache,
            feed_registry,
            task_handle,
        })
    }

    /// Get the price cache for reading latest prices.
    pub fn price_cache(&self) -> &PriceCache {
        &self.price_cache
    }

    /// Get the feed registry.
    pub fn feed_registry(&self) -> &FeedRegistry {
        &self.feed_registry
    }

    /// Check if the receiver task is still running.
    pub fn is_running(&self) -> bool {
        !self.task_handle.is_finished()
    }

    /// Get a reference to the task handle for monitoring.
    pub fn task_handle(&self) -> &JoinHandle<()> {
        &self.task_handle
    }
}

/// Process incoming Lazer price updates and cache them.
async fn process_lazer_updates(
    mut receiver: tokio::sync::mpsc::Receiver<AnyResponse>,
    price_cache: PriceCache,
    feed_registry: FeedRegistry,
    metrics: Option<BaseMetrics>,
    runtime: AppRuntime,
) {
    info!("starting Lazer update processor");

    loop {
        let response = tokio::select! {
            _ = runtime.cancelled() => {
                info!("Lazer receiver shutdown requested");
                break;
            }
            msg = receiver.recv() => {
                match msg {
                    Some(r) => r,
                    #[allow(clippy::panic, reason = "intentional crash on SDK channel drop")]
                    None => {
                        panic!("Lazer receiver channel closed unexpectedly");
                    },
                }
            }
        };

        match response {
            AnyResponse::Json(ws_response) => {
                if let WsResponse::StreamUpdated(update) = ws_response {
                    // Process parsed payload
                    if let Some(parsed) = update.payload.parsed {
                        // Convert timestamp from microseconds to milliseconds
                        let timestamp_ms = parsed.timestamp_us.as_millis();

                        for feed_payload in parsed.price_feeds {
                            let feed_id = feed_payload.price_feed_id;

                            if feed_registry.has_feed(feed_id) {
                                // Record metrics if available
                                if let Some(ref m) = metrics {
                                    m.record_lazer_update(feed_id.0);
                                }

                                // Update cache
                                let cached = CachedPrice {
                                    data: feed_payload,
                                    timestamp_ms,
                                    feed_id,
                                };

                                let mut cache = price_cache.write().await;
                                cache.insert(feed_id, cached);
                            }
                        }
                    }
                }
            }
            AnyResponse::Binary(_) => {
                // We requested JSON format, so this shouldn't happen often
                debug!("received binary message (ignored)");
            }
        }
    }

    warn!("Lazer receiver closed");
}
