#[deprecated(note = b"Use `pyth_lazer::update_v2` instead.")]
module pyth_lazer::update;

use pyth_lazer::channel::{Self, Channel};
use pyth_lazer::feed::Feed;
use pyth_lazer::update_v2;

#[deprecated(note = b"Use `update_v2::Update` instead.")]
public struct Update has copy, drop {
    timestamp: u64,
    channel: Channel,
    feeds: vector<Feed>,
}

#[deprecated(note = b"Use `update_v2::Update` instead.")]
public fun timestamp(update: &Update): u64 {
    update.timestamp
}

#[deprecated(note = b"Use `update_v2::Update` instead.")]
public fun channel(update: &Update): Channel {
    update.channel
}

#[deprecated(note = b"Use `update_v2::Update` instead.")]
public fun feeds(update: &Update): vector<Feed> {
    update.feeds
}

#[deprecated(note = b"Use `update_v2::Update` instead.")]
public fun feeds_ref(update: &Update): &vector<Feed> {
    &update.feeds
}

#[allow(deprecated_usage)]
public(package) fun from_v2(update: update_v2::Update): Update {
    Update {
        timestamp: update.timestamp(),
        channel: channel::from_v2(update.channel()),
        feeds: update.feeds(),
    }
}
