module pyth::set_update_fee {
    use sui::math::{Self};

    use pyth::deserialize;
    use pyth::state::{Self, State, LatestOnly};

    use wormhole::cursor;


    friend pyth::governance;

    const MAX_U64: u128 = (1 << 64) - 1;
    const E_EXPONENT_DOES_NOT_FIT_IN_U8: u64 = 0;

    struct UpdateFee {
        mantissa: u64,
        exponent: u64,
    }

    public(friend) fun execute(latest_only: &LatestOnly, pyth_state: &mut State, payload: vector<u8>) {
        let UpdateFee { mantissa, exponent } = from_byte_vec(payload);
        assert!(exponent <= 255, E_EXPONENT_DOES_NOT_FIT_IN_U8);
        let fee = apply_exponent(mantissa, (exponent as u8));
        state::set_base_update_fee(latest_only, pyth_state, fee);
    }

    fun from_byte_vec(bytes: vector<u8>): UpdateFee {
        let cursor = cursor::new(bytes);
        let mantissa = deserialize::deserialize_u64(&mut cursor);
        let exponent = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        UpdateFee {
            mantissa,
            exponent,
        }
    }

    fun apply_exponent(mantissa: u64, exponent: u8): u64 {
        mantissa * math::pow(10, exponent)
    }
}
