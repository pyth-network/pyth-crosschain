module pyth::event {
    use std::event::{Self, EventHandle};
    use pyth::price_feed::{PriceFeed};
    use std::account;

    friend pyth::pyth;

    /// Signifies that a price feed has been updated
    struct PriceFeedUpdate has store, drop {
        /// Value of the price feed
        price_feed: PriceFeed,
        /// Timestamp of the update
        timestamp: u64,
    }

    struct PriceFeedUpdateHandle has key, store {
        event: EventHandle<PriceFeedUpdate>
    }

    public(friend) fun init(pyth: &signer) {
        move_to(
            pyth,
            PriceFeedUpdateHandle {
                event: account::new_event_handle<PriceFeedUpdate>(pyth)
            }
        );
    }

    public(friend) fun emit_price_feed_update(price_feed: PriceFeed, timestamp: u64) acquires PriceFeedUpdateHandle {
        let event_handle = borrow_global_mut<PriceFeedUpdateHandle>(@pyth);
        event::emit_event<PriceFeedUpdate>(
            &mut event_handle.event,
            PriceFeedUpdate {
                price_feed,
                timestamp,
            }
        );
    }
}
