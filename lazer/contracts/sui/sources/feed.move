module pyth_lazer::feed;

use pyth_lazer::i16::I16;
use pyth_lazer::i64::I64;

/// The feed struct is based on the Lazer rust protocol definition defined here:
/// https://github.com/pyth-network/pyth-crosschain/blob/main/lazer/sdk/rust/protocol/src/types.rs#L10
///
/// Some fields in Lazer are optional, as in Lazer might return None for them due to some conditions (for example,
/// not having enough publishers to calculate the price) and that is why they are represented as Option<Option<T>>.
/// The first Option<T> is for the existence of the field within the update data and the second Option<T> is for the
/// value of the field.
public struct Feed has copy, drop {
    /// Unique identifier for the price feed (e.g., 1 for BTC/USD, 2 for ETH/USD)
    feed_id: u32,
    /// Current aggregate price from all publishers
    price: Option<Option<I64>>,
    /// Best bid price available across all publishers
    best_bid_price: Option<Option<I64>>,
    /// Best ask price available across all publishers
    best_ask_price: Option<Option<I64>>,
    /// Number of publishers contributing to this price feed
    publisher_count: Option<u16>,
    /// Price exponent (typically negative, e.g., -8 means divide price by 10^8)
    exponent: Option<I16>,
    /// Confidence interval representing price uncertainty
    confidence: Option<Option<I64>>,
    /// Funding rate for derivative products (e.g., perpetual futures)
    funding_rate: Option<Option<I64>>,
    /// Timestamp when the funding rate was last updated
    funding_timestamp: Option<Option<u64>>,
}

/// Create a new Feed with the specified parameters
public fun new(
    feed_id: u32,
    price: Option<Option<I64>>,
    best_bid_price: Option<Option<I64>>,
    best_ask_price: Option<Option<I64>>,
    publisher_count: Option<u16>,
    exponent: Option<I16>,
    confidence: Option<Option<I64>>,
    funding_rate: Option<Option<I64>>,
    funding_timestamp: Option<Option<u64>>,
): Feed {
    Feed {
        feed_id,
        price,
        best_bid_price,
        best_ask_price,
        publisher_count,
        exponent,
        confidence,
        funding_rate,
        funding_timestamp,
    }
}

/// Get the feed ID
public fun feed_id(feed: &Feed): u32 {
    feed.feed_id
}

/// Get the price
public fun price(feed: &Feed): Option<Option<I64>> {
    feed.price
}

/// Get the best bid price
public fun best_bid_price(feed: &Feed): Option<Option<I64>> {
    feed.best_bid_price
}

/// Get the best ask price
public fun best_ask_price(feed: &Feed): Option<Option<I64>> {
    feed.best_ask_price
}

/// Get the publisher count
public fun publisher_count(feed: &Feed): Option<u16> {
    feed.publisher_count
}

/// Get the exponent
public fun exponent(feed: &Feed): Option<I16> {
    feed.exponent
}

/// Get the confidence interval
public fun confidence(feed: &Feed): Option<Option<I64>> {
    feed.confidence
}

/// Get the funding rate
public fun funding_rate(feed: &Feed): Option<Option<I64>> {
    feed.funding_rate
}

/// Get the funding timestamp
public fun funding_timestamp(feed: &Feed): Option<Option<u64>> {
    feed.funding_timestamp
}

/// Set the feed ID
public fun set_feed_id(feed: &mut Feed, feed_id: u32) {
    feed.feed_id = feed_id;
}

/// Set the price
public fun set_price(feed: &mut Feed, price: Option<Option<I64>>) {
    feed.price = price;
}

/// Set the best bid price
public fun set_best_bid_price(feed: &mut Feed, best_bid_price: Option<Option<I64>>) {
    feed.best_bid_price = best_bid_price;
}

/// Set the best ask price
public fun set_best_ask_price(feed: &mut Feed, best_ask_price: Option<Option<I64>>) {
    feed.best_ask_price = best_ask_price;
}

/// Set the publisher count
public fun set_publisher_count(feed: &mut Feed, publisher_count: Option<u16>) {
    feed.publisher_count = publisher_count;
}

/// Set the exponent
public fun set_exponent(feed: &mut Feed, exponent: Option<I16>) {
    feed.exponent = exponent;
}

/// Set the confidence interval
public fun set_confidence(feed: &mut Feed, confidence: Option<Option<I64>>) {
    feed.confidence = confidence;
}

/// Set the funding rate
public fun set_funding_rate(feed: &mut Feed, funding_rate: Option<Option<I64>>) {
    feed.funding_rate = funding_rate;
}

/// Set the funding timestamp
public fun set_funding_timestamp(feed: &mut Feed, funding_timestamp: Option<Option<u64>>) {
    feed.funding_timestamp = funding_timestamp;
}
