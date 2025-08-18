module pyth_lazer::channel;

public enum Channel has copy, drop {
    Invalid,
    RealTime,
    FixedRate50ms,
    FixedRate200ms,
}

/// Check if the channel is Invalid
public fun is_invalid(channel: &Channel): bool {
    match (channel) {
        Channel::Invalid => true,
        _ => false,
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
