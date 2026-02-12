//! Feed subscription configuration and channel grouping.
//!
//! Tracks which Lazer feed IDs we're interested in and groups them by channel
//! for subscription. Lazer requires separate subscriptions per channel.

use pyth_lazer_protocol::{api::Channel, time::FixedRate, PriceFeedId};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::time::Duration;

/// Lazer subscription channel.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Deserialize)]
pub enum LazerChannel {
    /// Real-time updates (as fast as available)
    #[serde(rename = "real_time")]
    RealTime,
    /// Fixed rate at 50ms intervals
    #[default]
    #[serde(rename = "fixed_rate_50ms")]
    FixedRate50ms,
    /// Fixed rate at 200ms intervals
    #[serde(rename = "fixed_rate_200ms")]
    FixedRate200ms,
    /// Fixed rate at 1000ms intervals
    #[serde(rename = "fixed_rate_1000ms")]
    FixedRate1000ms,
}

impl LazerChannel {
    /// Convert to the protocol's Channel type.
    pub fn to_protocol_channel(self) -> Channel {
        match self {
            Self::RealTime => Channel::RealTime,
            Self::FixedRate50ms => Channel::FixedRate(FixedRate::RATE_50_MS),
            Self::FixedRate200ms => Channel::FixedRate(FixedRate::RATE_200_MS),
            Self::FixedRate1000ms => Channel::FixedRate(FixedRate::RATE_1000_MS),
        }
    }
}

impl std::fmt::Display for LazerChannel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::RealTime => write!(f, "real_time"),
            Self::FixedRate50ms => write!(f, "fixed_rate_50ms"),
            Self::FixedRate200ms => write!(f, "fixed_rate_200ms"),
            Self::FixedRate1000ms => write!(f, "fixed_rate_1000ms"),
        }
    }
}

/// Configuration for price feeds.
#[derive(Debug, Clone, Deserialize)]
pub struct FeedsConfig {
    /// Feed subscriptions - each feed specifies its ID and channel
    /// Feeds are grouped by channel for subscription (Lazer requires one subscription per channel)
    pub subscriptions: Vec<FeedSubscription>,

    /// Update interval (how often to batch and push)
    #[serde(with = "humantime_serde", default = "default_update_interval")]
    pub update_interval: Duration,
}

/// A single feed subscription configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct FeedSubscription {
    /// Pyth Lazer price feed ID
    pub feed_id: u32,

    /// Channel to subscribe to
    /// Feeds with the same channel are grouped into one subscription
    #[serde(default)]
    pub channel: LazerChannel,
}

fn default_update_interval() -> Duration {
    Duration::from_millis(100)
}

/// Registry of Lazer feed subscriptions grouped by channel.
#[derive(Debug, Clone)]
pub struct FeedRegistry {
    /// Set of all feed IDs we're tracking
    all_feed_ids: HashSet<PriceFeedId>,
    /// Feeds grouped by channel
    feeds_by_channel: HashMap<LazerChannel, Vec<PriceFeedId>>,
}

impl FeedRegistry {
    /// Create a new feed registry from subscription config.
    pub fn from_subscriptions(subscriptions: &[FeedSubscription]) -> Self {
        let mut all_feed_ids = HashSet::new();
        let mut feeds_by_channel: HashMap<LazerChannel, Vec<PriceFeedId>> = HashMap::new();

        for sub in subscriptions {
            let feed_id = PriceFeedId(sub.feed_id);
            all_feed_ids.insert(feed_id);
            feeds_by_channel
                .entry(sub.channel)
                .or_default()
                .push(feed_id);
        }

        Self {
            all_feed_ids,
            feeds_by_channel,
        }
    }

    /// Check if we're tracking a specific feed ID.
    pub fn has_feed(&self, feed_id: PriceFeedId) -> bool {
        self.all_feed_ids.contains(&feed_id)
    }

    /// Get all feed IDs we're tracking.
    pub fn feed_ids(&self) -> impl Iterator<Item = &PriceFeedId> {
        self.all_feed_ids.iter()
    }

    /// Get feeds grouped by channel for creating subscriptions.
    pub fn feeds_by_channel(&self) -> &HashMap<LazerChannel, Vec<PriceFeedId>> {
        &self.feeds_by_channel
    }

    /// Get the number of feeds being tracked.
    pub fn len(&self) -> usize {
        self.all_feed_ids.len()
    }

    /// Check if there are no feeds being tracked.
    pub fn is_empty(&self) -> bool {
        self.all_feed_ids.is_empty()
    }

    /// Get the number of channels (subscriptions needed).
    pub fn channel_count(&self) -> usize {
        self.feeds_by_channel.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_feed_registry_grouping() {
        let subscriptions = vec![
            FeedSubscription {
                feed_id: 1,
                channel: LazerChannel::FixedRate50ms,
            },
            FeedSubscription {
                feed_id: 2,
                channel: LazerChannel::FixedRate50ms,
            },
            FeedSubscription {
                feed_id: 3,
                channel: LazerChannel::FixedRate200ms,
            },
        ];

        let registry = FeedRegistry::from_subscriptions(&subscriptions);

        assert_eq!(registry.len(), 3);
        assert_eq!(registry.channel_count(), 2);
        assert!(registry.has_feed(PriceFeedId(1)));
        assert!(registry.has_feed(PriceFeedId(2)));
        assert!(registry.has_feed(PriceFeedId(3)));
        assert!(!registry.has_feed(PriceFeedId(999)));

        let by_channel = registry.feeds_by_channel();
        assert_eq!(
            by_channel.get(&LazerChannel::FixedRate50ms).map(Vec::len),
            Some(2)
        );
        assert_eq!(
            by_channel.get(&LazerChannel::FixedRate200ms).map(Vec::len),
            Some(1)
        );
    }

    #[test]
    fn test_lazer_channel_to_protocol() {
        assert!(matches!(
            LazerChannel::RealTime.to_protocol_channel(),
            Channel::RealTime
        ));
        assert!(matches!(
            LazerChannel::FixedRate50ms.to_protocol_channel(),
            Channel::FixedRate(_)
        ));
    }

    #[test]
    fn test_lazer_channel_all_variants_to_protocol() {
        // RealTime
        assert!(matches!(
            LazerChannel::RealTime.to_protocol_channel(),
            Channel::RealTime
        ));

        // Fixed rates
        assert!(matches!(
            LazerChannel::FixedRate50ms.to_protocol_channel(),
            Channel::FixedRate(_)
        ));
        assert!(matches!(
            LazerChannel::FixedRate200ms.to_protocol_channel(),
            Channel::FixedRate(_)
        ));
        assert!(matches!(
            LazerChannel::FixedRate1000ms.to_protocol_channel(),
            Channel::FixedRate(_)
        ));
    }

    #[test]
    fn test_lazer_channel_default() {
        let channel = LazerChannel::default();
        assert_eq!(channel, LazerChannel::FixedRate50ms);
    }

    #[test]
    fn test_lazer_channel_display() {
        assert_eq!(LazerChannel::RealTime.to_string(), "real_time");
        assert_eq!(LazerChannel::FixedRate50ms.to_string(), "fixed_rate_50ms");
        assert_eq!(LazerChannel::FixedRate200ms.to_string(), "fixed_rate_200ms");
        assert_eq!(
            LazerChannel::FixedRate1000ms.to_string(),
            "fixed_rate_1000ms"
        );
    }

    #[test]
    fn test_feed_registry_empty() {
        let registry = FeedRegistry::from_subscriptions(&[]);
        assert!(registry.is_empty());
        assert_eq!(registry.len(), 0);
        assert_eq!(registry.channel_count(), 0);
    }

    #[test]
    fn test_feed_registry_single_feed() {
        let subscriptions = vec![FeedSubscription {
            feed_id: 42,
            channel: LazerChannel::RealTime,
        }];

        let registry = FeedRegistry::from_subscriptions(&subscriptions);

        assert!(!registry.is_empty());
        assert_eq!(registry.len(), 1);
        assert_eq!(registry.channel_count(), 1);
        assert!(registry.has_feed(PriceFeedId(42)));
    }

    #[test]
    fn test_feed_registry_all_channels() {
        let subscriptions = vec![
            FeedSubscription {
                feed_id: 1,
                channel: LazerChannel::RealTime,
            },
            FeedSubscription {
                feed_id: 2,
                channel: LazerChannel::FixedRate50ms,
            },
            FeedSubscription {
                feed_id: 3,
                channel: LazerChannel::FixedRate200ms,
            },
            FeedSubscription {
                feed_id: 4,
                channel: LazerChannel::FixedRate1000ms,
            },
        ];

        let registry = FeedRegistry::from_subscriptions(&subscriptions);

        assert_eq!(registry.len(), 4);
        assert_eq!(registry.channel_count(), 4);
    }

    #[test]
    fn test_feed_registry_duplicate_feed_id() {
        // Same feed ID in different channels - HashSet deduplicates
        let subscriptions = vec![
            FeedSubscription {
                feed_id: 1,
                channel: LazerChannel::FixedRate50ms,
            },
            FeedSubscription {
                feed_id: 1,
                channel: LazerChannel::FixedRate200ms,
            },
        ];

        let registry = FeedRegistry::from_subscriptions(&subscriptions);

        // Feed ID appears once in all_feed_ids
        assert_eq!(registry.len(), 1);
        // But appears in both channel groups
        assert_eq!(registry.channel_count(), 2);
    }

    #[test]
    fn test_feed_registry_feed_ids_iterator() {
        let subscriptions = vec![
            FeedSubscription {
                feed_id: 10,
                channel: LazerChannel::FixedRate50ms,
            },
            FeedSubscription {
                feed_id: 20,
                channel: LazerChannel::FixedRate50ms,
            },
        ];

        let registry = FeedRegistry::from_subscriptions(&subscriptions);

        let mut feed_ids: Vec<u32> = registry.feed_ids().map(|id| id.0).collect();
        feed_ids.sort();

        assert_eq!(feed_ids, vec![10, 20]);
    }

    #[test]
    fn test_default_update_interval() {
        let interval = default_update_interval();
        assert_eq!(interval, Duration::from_millis(100));
    }

    #[test]
    fn test_feed_subscription_default_channel() {
        // When deserializing without channel, it should default to FixedRate50ms
        let json = r#"{"feed_id": 1}"#;
        let sub: FeedSubscription = serde_json::from_str(json).unwrap();
        assert_eq!(sub.feed_id, 1);
        assert_eq!(sub.channel, LazerChannel::FixedRate50ms);
    }

    #[test]
    fn test_feed_subscription_deserialization() {
        let json = r#"{"feed_id": 42, "channel": "real_time"}"#;
        let sub: FeedSubscription = serde_json::from_str(json).unwrap();
        assert_eq!(sub.feed_id, 42);
        assert_eq!(sub.channel, LazerChannel::RealTime);
    }

    #[test]
    fn test_lazer_channel_deserialization() {
        assert_eq!(
            serde_json::from_str::<LazerChannel>(r#""real_time""#).unwrap(),
            LazerChannel::RealTime
        );
        assert_eq!(
            serde_json::from_str::<LazerChannel>(r#""fixed_rate_50ms""#).unwrap(),
            LazerChannel::FixedRate50ms
        );
        assert_eq!(
            serde_json::from_str::<LazerChannel>(r#""fixed_rate_200ms""#).unwrap(),
            LazerChannel::FixedRate200ms
        );
        assert_eq!(
            serde_json::from_str::<LazerChannel>(r#""fixed_rate_1000ms""#).unwrap(),
            LazerChannel::FixedRate1000ms
        );
    }
}
