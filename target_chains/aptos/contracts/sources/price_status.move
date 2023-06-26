module pyth::price_status {
    use pyth::error;

    /// The price feed is not currently updating for an unknown reason.
    const UNKNOWN: u64 = 0;
    /// The price feed is updating as expected.
    const TRADING: u64 = 1;

    /// PriceStatus represents the availability status of a price feed.
    /// Prices should only be used if they have a status of trading.
    struct PriceStatus has copy, drop, store {
        status: u64,
    }

    public fun from_u64(status: u64): PriceStatus {
        assert!(status <= TRADING, error::invalid_price_status());
        PriceStatus {
            status: status
        }
    }

    public fun get_status(price_status: &PriceStatus): u64 {
        price_status.status
    }

    public fun new_unknown(): PriceStatus {
        PriceStatus {
            status: UNKNOWN,
        }
    }

    public fun new_trading(): PriceStatus {
        PriceStatus {
            status: TRADING,
        }
    }

    #[test]
    fun test_unknown_status() {
        assert!(PriceStatus{ status: UNKNOWN } == from_u64(0), 1);
    }

    #[test]
    fun test_trading_status() {
        assert!(PriceStatus{ status: TRADING } == from_u64(1), 1);
    }

    #[test]
    #[expected_failure(abort_code = 65559, location = pyth::price_status)]
    fun test_invalid_price_status() {
        from_u64(3);
    }
}
