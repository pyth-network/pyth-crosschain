module pyth::set_stale_price_threshold {
    use wormhole::cursor;
    use pyth::deserialize;
    use pyth::state::{Self, State, LatestOnly};

    friend pyth::governance;

    struct StalePriceThreshold {
        threshold: u64,
    }

    public(friend) fun execute(latest_only: &LatestOnly, state: &mut State, payload: vector<u8>) {
        let StalePriceThreshold { threshold } = from_byte_vec(payload);
        state::set_stale_price_threshold_secs(latest_only, state, threshold);
    }

    fun from_byte_vec(bytes: vector<u8>): StalePriceThreshold {
        let cursor = cursor::new(bytes);
        let threshold = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        StalePriceThreshold {
            threshold
        }
    }
}
