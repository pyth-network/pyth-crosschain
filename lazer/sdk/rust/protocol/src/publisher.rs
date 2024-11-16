//! WebSocket JSON protocol types for API the publisher provides to the router.
//! Publisher data sourcing may also be implemented in the router process,
//! eliminating WebSocket overhead.

use {
    super::router::{Price, PriceFeedId, TimestampUs},
    serde::{Deserialize, Serialize},
};

/// Represents a binary (bincode-serialized) stream update sent
/// from the publisher to the router.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceFeedData {
    pub price_feed_id: PriceFeedId,
    /// Timestamp of the last update provided by the source of the prices
    /// (like an exchange). If unavailable, this value is set to `publisher_timestamp_us`.
    pub source_timestamp_us: TimestampUs,
    /// Timestamp of the last update provided by the publisher.
    pub publisher_timestamp_us: TimestampUs,
    /// Last known value of the "main" (?) price of this price feed.
    /// `None` if no value is currently available.
    pub price: Option<Price>,
    /// Last known value of the best bid price of this price feed.
    /// `None` if no value is currently available.
    pub best_bid_price: Option<Price>,
    /// Last known value of the best ask price of this price feed.
    /// `None` if no value is currently available.
    pub best_ask_price: Option<Price>,
}
