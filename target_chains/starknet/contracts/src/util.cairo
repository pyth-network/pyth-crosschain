mod exp10_;
use core::fmt::Formatter;
use core::integer::u128_byte_reverse;

pub use exp10_::exp10;

pub const ONE_SHIFT_160: u256 = 0x10000000000000000000000000000000000000000;
pub const ONE_SHIFT_96: u256 = 0x1000000000000000000000000;

pub const ONE_SHIFT_64: u128 = 0x10000000000000000;

pub const UNEXPECTED_OVERFLOW: felt252 = 'unexpected overflow';
pub const UNEXPECTED_ZERO: felt252 = 'unexpected zero';

// Returns 1 << (8 * `n_bytes`) as u256.
//
// Panics if `n_bytes >= 32`.
pub fn one_shift_left_bytes_u256(n_bytes: u8) -> u256 {
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
        16 => 0x100000000000000000000000000000000,
        17 => 0x10000000000000000000000000000000000,
        18 => 0x1000000000000000000000000000000000000,
        19 => 0x100000000000000000000000000000000000000,
        20 => 0x10000000000000000000000000000000000000000,
        21 => 0x1000000000000000000000000000000000000000000,
        22 => 0x100000000000000000000000000000000000000000000,
        23 => 0x10000000000000000000000000000000000000000000000,
        24 => 0x1000000000000000000000000000000000000000000000000,
        25 => 0x100000000000000000000000000000000000000000000000000,
        26 => 0x10000000000000000000000000000000000000000000000000000,
        27 => 0x1000000000000000000000000000000000000000000000000000000,
        28 => 0x100000000000000000000000000000000000000000000000000000000,
        29 => 0x10000000000000000000000000000000000000000000000000000000000,
        30 => 0x1000000000000000000000000000000000000000000000000000000000000,
        31 => 0x100000000000000000000000000000000000000000000000000000000000000,
        _ => core::panic_with_felt252('n_bytes too big'),
    }
}

// Returns 1 << (8 * `n_bytes`) as u128.
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

impl UnwrapWithFelt252Impl<T, E, +Into<E, felt252>> of UnwrapWithFelt252<T, E> {
    fn unwrap_with_felt252(self: Result<T, E>) -> T {
        match self {
            Result::Ok(v) => v,
            Result::Err(err) => core::panic_with_felt252(err.into()),
        }
    }
}

/// Reinterpret `u64` as `i64` as if it was a two's complement binary representation.
pub fn u64_as_i64(value: u64) -> i64 {
    if value < 0x8000000000000000 {
        value.try_into().unwrap()
    } else {
        let value: i128 = value.into();
        (value - 0x10000000000000000).try_into().unwrap()
    }
}

/// Reinterpret `u32` as `i32` as if it was a two's complement binary representation.
pub fn u32_as_i32(value: u32) -> i32 {
    if value < 0x80000000 {
        value.try_into().unwrap()
    } else {
        let value: i64 = value.into();
        (value - 0x100000000).try_into().unwrap()
    }
}

pub fn write_i64(ref f: Formatter, value: i64) -> Result<(), core::fmt::Error> {
    if value >= 0 {
        let value: u128 = value.try_into().unwrap();
        write!(f, "{}", value)
    } else {
        let value: i128 = value.into();
        let value: u128 = (-value).try_into().unwrap();
        write!(f, "-{}", value)
    }
}

pub fn array_try_into<T, U, +TryInto<T, U>, +Drop<T>, +Drop<U>>(mut input: Array<T>) -> Array<U> {
    let mut output = array![];
    loop {
        match input.pop_front() {
            Option::Some(v) => { output.append(v.try_into().unwrap()); },
            Option::None => { break; },
        }
    }
    output
}

pub trait ResultMapErrInto<T, E1, E2> {
    fn map_err_into(self: Result<T, E1>) -> Result<T, E2>;
}

impl ResultMapErrIntoImpl<T, E1, E2, +Into<E1, E2>> of ResultMapErrInto<T, E1, E2> {
    fn map_err_into(self: Result<T, E1>) -> Result<T, E2> {
        match self {
            Result::Ok(v) => Result::Ok(v),
            Result::Err(err) => Result::Err(err.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{u32_as_i32, u64_as_i64};

    #[test]
    fn test_u64_as_i64() {
        assert!(u64_as_i64(0) == 0);
        assert!(u64_as_i64(1) == 1);
        assert!(u64_as_i64(2) == 2);
        assert!(u64_as_i64(3) == 3);
        assert!(u64_as_i64(9223372036854775806) == 9223372036854775806);
        assert!(u64_as_i64(9223372036854775807) == 9223372036854775807);
        assert!(u64_as_i64(9223372036854775808) == -9223372036854775808);
        assert!(u64_as_i64(9223372036854775809) == -9223372036854775807);
        assert!(u64_as_i64(18446744073709551614) == -2);
        assert!(u64_as_i64(18446744073709551615) == -1);
    }

    #[test]
    fn test_u32_as_i32() {
        assert!(u32_as_i32(0) == 0);
        assert!(u32_as_i32(1) == 1);
        assert!(u32_as_i32(2) == 2);
        assert!(u32_as_i32(3) == 3);
        assert!(u32_as_i32(2147483646) == 2147483646);
        assert!(u32_as_i32(2147483647) == 2147483647);
        assert!(u32_as_i32(2147483648) == -2147483648);
        assert!(u32_as_i32(2147483649) == -2147483647);
        assert!(u32_as_i32(4294967294) == -2);
        assert!(u32_as_i32(4294967295) == -1);
    }
}
