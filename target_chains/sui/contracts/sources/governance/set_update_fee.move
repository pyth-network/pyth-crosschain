module pyth::set_update_fee;

use pyth::deserialize;
use pyth::state::{Self, State, LatestOnly};
use sui::math;
use wormhole::cursor;

const EExponentDoesNotFitInU8: u64 = 0;

public struct UpdateFee {
    mantissa: u64,
    exponent: u64,
}

public(package) fun execute(latest_only: &LatestOnly, pyth_state: &mut State, payload: vector<u8>) {
    let UpdateFee { mantissa, exponent } = from_byte_vec(payload);
    assert!(exponent <= 255, EExponentDoesNotFitInU8);
    let fee = apply_exponent(mantissa, (exponent as u8));
    state::set_base_update_fee(latest_only, pyth_state, fee);
}

fun from_byte_vec(bytes: vector<u8>): UpdateFee {
    let mut cursor = cursor::new(bytes);
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
