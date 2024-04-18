use core::integer::u128_byte_reverse;

pub const ONE_SHIFT_160: u256 = 0x10000000000000000000000000000000000000000;
pub const ONE_SHIFT_96: u256 = 0x1000000000000000000000000;

pub const ONE_SHIFT_64: u128 = 0x10000000000000000;

pub const UNEXPECTED_OVERFLOW: felt252 = 'unexpected overflow';
pub const UNEXPECTED_ZERO: felt252 = 'unexpected zero';

// Returns 1 << (8 * `n_bytes`) as u128, where `n_bytes` must be < BYTES_IN_U128.
//
// Panics if `n_bytes >= 16`.
pub fn one_shift_left_bytes_u128(n_bytes: u8) -> u128 {
    match n_bytes {
        0 => 0x1,
        1 => 0x100,
        2 => 0x10000,
        3 => 0x1000000,
        4 => 0x100000000,
        5 => 0x10000000000,
        6 => 0x1000000000000,
        7 => 0x100000000000000,
        8 => 0x10000000000000000,
        9 => 0x1000000000000000000,
        10 => 0x100000000000000000000,
        11 => 0x10000000000000000000000,
        12 => 0x1000000000000000000000000,
        13 => 0x100000000000000000000000000,
        14 => 0x10000000000000000000000000000,
        15 => 0x1000000000000000000000000000000,
        _ => core::panic_with_felt252('n_bytes too big'),
    }
}

// Returns 1 << (8 * `n_bytes`) as u64.
//
// Panics if `n_bytes >= 8`.
pub fn one_shift_left_bytes_u64(n_bytes: u8) -> u64 {
    match n_bytes {
        0 => 0x1,
        1 => 0x100,
        2 => 0x10000,
        3 => 0x1000000,
        4 => 0x100000000,
        5 => 0x10000000000,
        6 => 0x1000000000000,
        7 => 0x100000000000000,
        _ => core::panic_with_felt252('n_bytes too big'),
    }
}

pub fn u64_byte_reverse(value: u64) -> u64 {
    let reversed = u128_byte_reverse(value.into()) / ONE_SHIFT_64.try_into().expect('not zero');
    reversed.try_into().unwrap()
}

/// If `self` is an error, panics with a `felt252` value
/// corresponding to the error. Otherwise, returns the success value.
/// This differs from `Result::unwrap` which always panics with
/// the same message and doesn't include information about the error.
pub trait UnwrapWithFelt252<T, E> {
    fn unwrap_with_felt252(self: Result<T, E>) -> T;
}
