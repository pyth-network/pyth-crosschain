module pyth_lazer::channel;

// Error codes for channel parsing
const EInvalidChannel: u64 = 1;

public enum Channel has copy, drop {
    RealTime,
    FixedRate50ms,
    FixedRate200ms,
}

/// Create a new RealTime channel
public fun new_real_time(): Channel {
    Channel::RealTime
}

/// Create a new FixedRate50ms channel
public fun new_fixed_rate_50ms(): Channel {
    Channel::FixedRate50ms
}

/// Create a new FixedRate200ms channel
public fun new_fixed_rate_200ms(): Channel {
    Channel::FixedRate200ms
}

/// Parse channel from a channel value byte
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

/// Check if the channel is RealTime
public fun is_real_time(channel: &Channel): bool {
    match (channel) {
        Channel::RealTime => true,
        _ => false,
    }
}

/// Check if the channel is FixedRate50ms
public fun is_fixed_rate_50ms(channel: &Channel): bool {
    match (channel) {
        Channel::FixedRate50ms => true,
        _ => false,
    }
}

/// Check if the channel is FixedRate200ms
public fun is_fixed_rate_200ms(channel: &Channel): bool {
    match (channel) {
        Channel::FixedRate200ms => true,
        _ => false,
    }
}

/// Get the update interval in milliseconds for fixed rate channels, returns 0 for non-fixed rate channels
public fun get_update_interval_ms(channel: &Channel): u64 {
    match (channel) {
        Channel::FixedRate50ms => 50,
        Channel::FixedRate200ms => 200,
        _ => 0,
    }
}
