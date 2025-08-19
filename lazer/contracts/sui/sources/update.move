module pyth_lazer::update;

use pyth_lazer::channel::Channel;
use pyth_lazer::feed::Feed;

public struct Update has copy, drop {
    timestamp: u64,
    channel: Channel,
    feeds: vector<Feed>,
}

public(package) fun new(
    timestamp: u64,
    channel: Channel,
    feeds: vector<Feed>
): Update {
    Update { timestamp, channel, feeds }
}

/// Get the timestamp of the update
public fun timestamp(update: &Update): u64 {
    update.timestamp
}

/// Get a reference to the channel of the update
public fun channel(update: &Update): Channel {
    update.channel
}

/// Get a reference to the feeds vector of the update
public fun feeds(update: &Update): vector<Feed> {
    update.feeds
}
