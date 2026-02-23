//! Shared types for price pushers.

use pyth_lazer_protocol::{api::ParsedFeedPayload, PriceFeedId};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Thread-safe cache of latest prices from Lazer, keyed by feed ID.
pub type PriceCache = Arc<RwLock<HashMap<PriceFeedId, CachedPrice>>>;

/// A cached price with metadata.
#[derive(Debug, Clone)]
pub struct CachedPrice {
    /// The parsed feed payload from Lazer
    pub data: ParsedFeedPayload,
    /// Timestamp when this price was received (milliseconds since epoch)
    pub timestamp_ms: u64,
    /// Lazer feed ID
    pub feed_id: PriceFeedId,
}
