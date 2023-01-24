module pyth::price_info {
    use pyth::price_feed::PriceFeed;

    struct PriceInfo has copy, drop, store {
        attestation_time: u64,
        arrival_time: u64,
        price_feed: PriceFeed,
    }

    public fun new(attestation_time: u64, arrival_time: u64, price_feed: PriceFeed): PriceInfo {
        PriceInfo {
            attestation_time: attestation_time,
            arrival_time: arrival_time,
            price_feed: price_feed,
        }
    }

    public fun get_price_feed(price_info: &PriceInfo): &PriceFeed {
        &price_info.price_feed
    }

    public fun get_attestation_time(price_info: &PriceInfo): u64 {
        price_info.attestation_time
    }

    public fun get_arrival_time(price_info: &PriceInfo): u64 {
        price_info.arrival_time
    }
}
