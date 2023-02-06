module pyth::set_stale_price_threshold {
    use wormhole::cursor;
    use pyth::deserialize;
    use pyth::state;

    friend pyth::governance;

    struct SetStalePriceThreshold {
        threshold: u64,
    }

    public(friend) fun execute(payload: vector<u8>) {
        let SetStalePriceThreshold { threshold } = from_byte_vec(payload);
        state::set_stale_price_threshold_secs(threshold);
    }

    fun from_byte_vec(bytes: vector<u8>): SetStalePriceThreshold {
        let cursor = cursor::init(bytes);
        let threshold = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        SetStalePriceThreshold {
            threshold
        }
    }
}
