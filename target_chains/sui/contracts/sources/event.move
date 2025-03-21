module pyth::event {
    use sui::event::{Self};
    use pyth::price_feed::{PriceFeed};

    friend pyth::pyth;
    friend pyth::state;

    struct PythInitializationEvent has copy, drop {}

    /// Signifies that a price feed has been updated
    struct PriceFeedUpdateEvent has copy, store, drop {
        /// Value of the price feed
        price_feed: PriceFeed,
        /// Timestamp of the update
        timestamp: u64,
    }

    public(friend) fun emit_price_feed_update(price_feed: PriceFeed, timestamp: u64 /* in seconds */) {
        event::emit(
            PriceFeedUpdateEvent {
                price_feed,
                timestamp,
            }
        );
    }

    public(friend) fun emit_pyth_initialization_event() {
        event::emit(
            PythInitializationEvent {}
        );
    }

}
