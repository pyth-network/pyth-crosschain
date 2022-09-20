module pyth::set_update_fee {
    use wormhole::cursor;
    use pyth::deserialize;
    use std::math64;
    use pyth::state;

    const MAX_U64: u128 = (1 << 64) - 1;

    const E_OVERFLOW: u64 = 15;

    struct SetUpdateFee {
        mantissa: u64,
        exponent: u64, 
    }

    public fun execute(payload: vector<u8>) {
        let SetUpdateFee { mantissa, exponent } = from_byte_vec(payload);
        let fee = apply_exponent(mantissa, exponent);
        state::set_update_fee(fee);
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
        let raised = mantissa * math64::pow(10, exponent);
        check_overflow(raised);
        raised
    }
    
    fun check_overflow(u: u64) {
        assert!((u as u128) <= MAX_U64, E_OVERFLOW)
    }

}
