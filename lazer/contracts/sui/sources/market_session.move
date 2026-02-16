module pyth_lazer::market_session;

#[error]
const EMarketSessionOutOfRange: vector<u8> = "Market session value out of range";

/// Market session enum. Use `is_*` methods to check current value.
public struct MarketSession(u16) has copy, drop, store;

public(package) fun from_u16(from: u16): MarketSession {
    assert!(from < 5, EMarketSessionOutOfRange);
    MarketSession(from)
}

public fun is_regular(self: &MarketSession): bool {
    self.0 == 0
}

public fun is_pre_market(self: &MarketSession): bool {
    self.0 == 1
}

public fun is_post_market(self: &MarketSession): bool {
    self.0 == 2
}

public fun is_over_night(self: &MarketSession): bool {
    self.0 == 3
}

public fun is_closed(self: &MarketSession): bool {
    self.0 == 4
}