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
    /// Last known value of the best executable price of this price feed.
    /// `None` if no value is currently available.
    #[serde(with = "crate::serde_price_as_i64")]
    pub price: Option<Price>,
    /// Last known value of the best bid price of this price feed.
    /// `None` if no value is currently available.
    #[serde(with = "crate::serde_price_as_i64")]
    pub best_bid_price: Option<Price>,
    /// Last known value of the best ask price of this price feed.
    /// `None` if no value is currently available.
    #[serde(with = "crate::serde_price_as_i64")]
    pub best_ask_price: Option<Price>,
}

#[test]
fn price_feed_data_serde() {
    let data = [
        1, 0, 0, 0, // price_feed_id
        2, 0, 0, 0, 0, 0, 0, 0, // source_timestamp_us
        3, 0, 0, 0, 0, 0, 0, 0, // publisher_timestamp_us
        4, 0, 0, 0, 0, 0, 0, 0, // price
        5, 0, 0, 0, 0, 0, 0, 0, // best_bid_price
        6, 2, 0, 0, 0, 0, 0, 0, // best_ask_price
    ];

    let expected = PriceFeedData {
        price_feed_id: PriceFeedId(1),
        source_timestamp_us: TimestampUs(2),
        publisher_timestamp_us: TimestampUs(3),
        price: Some(Price(4.try_into().unwrap())),
        best_bid_price: Some(Price(5.try_into().unwrap())),
        best_ask_price: Some(Price((2 * 256 + 6).try_into().unwrap())),
    };
    assert_eq!(
        bincode::deserialize::<PriceFeedData>(&data).unwrap(),
        expected
    );
    assert_eq!(bincode::serialize(&expected).unwrap(), data);

    let data2 = [
        1, 0, 0, 0, // price_feed_id
        2, 0, 0, 0, 0, 0, 0, 0, // source_timestamp_us
        3, 0, 0, 0, 0, 0, 0, 0, // publisher_timestamp_us
        4, 0, 0, 0, 0, 0, 0, 0, // price
        0, 0, 0, 0, 0, 0, 0, 0, // best_bid_price
        0, 0, 0, 0, 0, 0, 0, 0, // best_ask_price
    ];
    let expected2 = PriceFeedData {
        price_feed_id: PriceFeedId(1),
        source_timestamp_us: TimestampUs(2),
        publisher_timestamp_us: TimestampUs(3),
        price: Some(Price(4.try_into().unwrap())),
        best_bid_price: None,
        best_ask_price: None,
    };
    assert_eq!(
        bincode::deserialize::<PriceFeedData>(&data2).unwrap(),
        expected2
    );
    assert_eq!(bincode::serialize(&expected2).unwrap(), data2);
}
