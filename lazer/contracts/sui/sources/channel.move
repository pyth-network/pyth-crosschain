#[deprecated(note = b"Use `pyth_lazer::channel_v2` instead.")]
module pyth_lazer::channel;

use pyth_lazer::channel_v2;

#[error]
const EInvalidChannel: vector<u8> = "Invalid channel value";

#[deprecated(note = b"Use `channel_v2::Channel` instead.")]
public enum Channel has copy, drop {
    RealTime,
    FixedRate50ms,
    FixedRate200ms,
}

#[deprecated(note = b"Use `channel_v2::Channel` instead.")]
public fun new_real_time(): Channel {
    Channel::RealTime
}

#[deprecated(note = b"Use `channel_v2::Channel` instead.")]
public fun new_fixed_rate_50ms(): Channel {
    Channel::FixedRate50ms
}

#[deprecated(note = b"Use `channel_v2::Channel` instead.")]
public fun new_fixed_rate_200ms(): Channel {
    Channel::FixedRate200ms
}

#[deprecated(note = b"Use `channel_v2::Channel` instead.")]
public fun from_u8(channel_value: u8): Channel {
    if (channel_value == 1) {
        new_real_time()
    } else if (channel_value == 2) {
        new_fixed_rate_50ms()
    } else if (channel_value == 3) {
        new_fixed_rate_200ms()
    } else {
        abort EInvalidChannel
    }
}

#[deprecated(note = b"Use `channel_v2::Channel` instead.")]
public fun is_real_time(channel: &Channel): bool {
    match (channel) {
        Channel::RealTime => true,
        _ => false,
    }
}

#[deprecated(note = b"Use `channel_v2::Channel` instead.")]
public fun is_fixed_rate_50ms(channel: &Channel): bool {
    match (channel) {
        Channel::FixedRate50ms => true,
        _ => false,
    }
}

#[deprecated(note = b"Use `channel_v2::Channel` instead.")]
public fun is_fixed_rate_200ms(channel: &Channel): bool {
    match (channel) {
        Channel::FixedRate200ms => true,
        _ => false,
    }
}

#[deprecated(note = b"Use `channel_v2::Channel` instead.")]
public fun get_update_interval_ms(channel: &Channel): u64 {
    match (channel) {
        Channel::FixedRate50ms => 50,
        Channel::FixedRate200ms => 200,
        _ => 0,
    }
}

#[allow(deprecated_usage)]
public(package) fun from_v2(channel: channel_v2::Channel): Channel {
    if (channel.is_real_time()) {
        Channel::RealTime
    } else if (channel.is_fixed_rate_50ms()) {
        Channel::FixedRate50ms
    } else if (channel.is_fixed_rate_200ms()) {
        Channel::FixedRate200ms
    } else {
        abort EInvalidChannel
    }
}
