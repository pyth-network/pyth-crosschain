module pyth::set_update_fee {
    use sui::math::{Self};

    use pyth::deserialize;
    use pyth::state::{Self, State};

    use wormhole::cursor;


    friend pyth::governance;

    const MAX_U64: u128 = (1 << 64) - 1;

    struct SetUpdateFee {
        mantissa: u64,
        exponent: u64,
    }

    public(friend) fun execute(pyth_state: &mut State, payload: vector<u8>) {
        let SetUpdateFee { mantissa, exponent } = from_byte_vec(payload);
        assert!(exponent <= 255, 0); // TODO - throw error that exponent does not fit in a u8
        let fee = apply_exponent(mantissa, (exponent as u8));
        state::set_base_update_fee(pyth_state, fee);
    }

    fun from_byte_vec(bytes: vector<u8>): SetUpdateFee {
        let cursor = cursor::new(bytes);
        let mantissa = deserialize::deserialize_u64(&mut cursor);
        let exponent = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        SetUpdateFee {
            mantissa,
            exponent,
        }
    }

    fun apply_exponent(mantissa: u64, exponent: u8): u64 {
        mantissa * math::pow(10, exponent)
    }
}
