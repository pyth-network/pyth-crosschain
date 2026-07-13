module pyth_lazer::channel;

#[error]
const EChannelOutOfRange: vector<u8> = b"Channel value out of range";

/// Channel enum. Use `is_*` methods to check current value.
public struct Channel(u8) has copy, drop, store;

public(package) fun from_u8(value: u8): Channel {
    assert!(value >= 1 && value <= 4, EChannelOutOfRange);
    Channel(value)
}

public fun is_real_time(self: &Channel): bool {
    self.0 == 1
}

public fun is_fixed_rate_50ms(self: &Channel): bool {
    self.0 == 2
}

public fun is_fixed_rate_200ms(self: &Channel): bool {
    self.0 == 3
}

public fun is_fixed_rate_1000ms(self: &Channel): bool {
    self.0 == 4
}

/// Returns the update interval in milliseconds for fixed rate channels, 0 for RealTime.
public fun get_update_interval_ms(self: &Channel): u64 {
    if (self.0 == 1) { 0 }
    else if (self.0 == 2) { 50 }
    else if (self.0 == 3) { 200 }
    else if (self.0 == 4) { 1000 }
    else { abort EChannelOutOfRange }
}
