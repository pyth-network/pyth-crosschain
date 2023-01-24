module pyth::set_update_fee {
    use wormhole::cursor;
    use pyth::deserialize;
    use std::math64;
    use pyth::state;

    friend pyth::governance;

    const MAX_U64: u128 = (1 << 64) - 1;

    struct SetUpdateFee {
        mantissa: u64,
        exponent: u64,
    }

    public(friend) fun execute(payload: vector<u8>) {
        let SetUpdateFee { mantissa, exponent } = from_byte_vec(payload);
        let fee = apply_exponent(mantissa, exponent);
        state::set_base_update_fee(fee);
    }

    fun from_byte_vec(bytes: vector<u8>): SetUpdateFee {
        let cursor = cursor::init(bytes);
        let mantissa = deserialize::deserialize_u64(&mut cursor);
        let exponent = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        SetUpdateFee {
            mantissa,
            exponent,
        }
    }

    fun apply_exponent(mantissa: u64, exponent: u64): u64 {
        mantissa * math64::pow(10, exponent)
    }
}
