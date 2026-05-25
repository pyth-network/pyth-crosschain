module pyth_lazer::update_v2;

use pyth_lazer::channel_v2::{Self, Channel};
use pyth_lazer::feed::{Self, Feed};
use sui::bcs;

#[error]
const ETrailingPayloadData: vector<u8> = "Trailing Update payload data";

public struct Update has copy, drop {
    timestamp: u64,
    channel: Channel,
    feeds: vector<Feed>,
}

public(package) fun new(timestamp: u64, channel: Channel, feeds: vector<Feed>): Update {
    Update { timestamp, channel, feeds }
}

/// Get the timestamp of the update.
public fun timestamp(update: &Update): u64 {
    update.timestamp
}

/// Get a reference to the channel of the update.
public fun channel(update: &Update): Channel {
    update.channel
}

/// Get a copy of the feeds vector of the update.
public fun feeds(update: &Update): vector<Feed> {
    update.feeds
}

/// Get a reference to the feeds vector of the update.
public fun feeds_ref(update: &Update): &vector<Feed> {
    &update.feeds
}

/// Parse the update from a BCS cursor containing the payload data.
/// Assumes the payload magic has already been validated and consumed.
public(package) fun parse_from_cursor(mut cursor: bcs::BCS): Update {
    let timestamp = cursor.peel_u64();

    let channel_value = cursor.peel_u8();
    let channel = channel_v2::from_u8(channel_value);

    let feed_count = cursor.peel_u8();
    let mut feeds = vector::empty<Feed>();
    let mut feed_i = 0;

    while (feed_i < feed_count) {
        let feed = feed::parse_from_cursor(&mut cursor);
        vector::push_back(&mut feeds, feed);
        feed_i = feed_i + 1;
    };

    let remaining_bytes = cursor.into_remainder_bytes();
    assert!(remaining_bytes.length() == 0, ETrailingPayloadData);

    Update { timestamp, channel, feeds }
}
