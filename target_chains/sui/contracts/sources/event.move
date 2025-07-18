module pyth::event;

use pyth::price_feed::PriceFeed;
use sui::event;

public struct PythInitializationEvent has copy, drop {}

/// Signifies that a price feed has been updated
public struct PriceFeedUpdateEvent has copy, drop, store {
    /// Value of the price feed
    price_feed: PriceFeed,
    /// Timestamp of the update
    timestamp: u64,
}

public(package) fun emit_price_feed_update(price_feed: PriceFeed, timestamp: u64 /* in seconds */) {
    event::emit(PriceFeedUpdateEvent {
        price_feed,
        timestamp,
    });
}

public(package) fun emit_pyth_initialization_event() {
    event::emit(PythInitializationEvent {});
}
