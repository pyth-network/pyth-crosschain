/// Adapted from pyth::i64, modified for i16

module pyth_lazer::i16;

const MAX_POSITIVE_MAGNITUDE: u64 = (1 << 15) - 1;  // 32767
const MAX_NEGATIVE_MAGNITUDE: u64 = (1 << 15);      // 32768

/// To consume these values, first call `get_is_negative()` to determine if the I16
/// represents a negative or positive value. Then call `get_magnitude_if_positive()` or
/// `get_magnitude_if_negative()` to get the magnitude of the number in unsigned u64 format.
/// This API forces consumers to handle positive and negative numbers safely.
public struct I16 has copy, drop, store {
    negative: bool,
    magnitude: u64,
}

public fun new(magnitude: u64, mut negative: bool): I16 {
    let mut max_magnitude = MAX_POSITIVE_MAGNITUDE;
    if (negative) {
        max_magnitude = MAX_NEGATIVE_MAGNITUDE;
    };
    assert!(magnitude <= max_magnitude, 0); //error::magnitude_too_large()

    // Ensure we have a single zero representation: (0, false).
    // (0, true) is invalid.
    if (magnitude == 0) {
        negative = false;
    };

    I16 {
        magnitude,
        negative,
    }
}

public fun get_is_negative(i: &I16): bool {
    i.negative
}

public fun get_magnitude_if_positive(in: &I16): u64 {
    assert!(!in.negative, 0); // error::negative_value()
    in.magnitude
}

public fun get_magnitude_if_negative(in: &I16): u64 {
    assert!(in.negative, 0); //error::positive_value()
    in.magnitude
}

public fun from_u16(from: u16): I16 {
    // Use the MSB to determine whether the number is negative or not.
    let from_u64 = (from as u64);
    let negative = (from_u64 >> 15) == 1;
    let magnitude = parse_magnitude(from_u64, negative);

    new(magnitude, negative)
}

fun parse_magnitude(from: u64, negative: bool): u64 {
    // If positive, then return the input verbatim
    if (!negative) {
        return from
    };

    // Otherwise convert from two's complement by inverting and adding 1
    // For 16-bit numbers, we only invert the lower 16 bits
    let inverted = from ^ 0xFFFF;
    inverted + 1
}

#[test]
fun test_max_positive_magnitude() {
    new(0x7FFF, false);  // 32767
    assert!(&new((1<<15) - 1, false) == &from_u16(((1<<15) - 1) as u16), 1);
}

#[test]
#[expected_failure]
fun test_magnitude_too_large_positive() {
    new(0x8000, false);  // 32768
}

#[test]
fun test_max_negative_magnitude() {
    new(0x8000, true);   // 32768
    assert!(&new(1<<15, true) == &from_u16((1<<15) as u16), 1);
}

#[test]
#[expected_failure]
fun test_magnitude_too_large_negative() {
    new(0x8001, true);   // 32769
}

#[test]
fun test_from_u16_positive() {
    assert!(from_u16(0x1234) == new(0x1234, false), 1);
}

#[test]
fun test_from_u16_negative() {
    assert!(from_u16(0xEDCC) == new(0x1234, true), 1);
}

#[test]
fun test_get_is_negative() {
    assert!(get_is_negative(&new(234, true)) == true, 1);
    assert!(get_is_negative(&new(767, false)) == false, 1);
}

#[test]
fun test_get_magnitude_if_positive_positive() {
    assert!(get_magnitude_if_positive(&new(7686, false)) == 7686, 1);
}

#[test]
#[expected_failure]
fun test_get_magnitude_if_positive_negative() {
    assert!(get_magnitude_if_positive(&new(7686, true)) == 7686, 1);
}

#[test]
fun test_get_magnitude_if_negative_negative() {
    assert!(get_magnitude_if_negative(&new(7686, true)) == 7686, 1);
}

#[test]
#[expected_failure]
fun test_get_magnitude_if_negative_positive() {
    assert!(get_magnitude_if_negative(&new(7686, false)) == 7686, 1);
}

#[test]
fun test_single_zero_representation() {
    assert!(&new(0, true) == &new(0, false), 1);
    assert!(&new(0, true) == &from_u16(0), 1);
    assert!(&new(0, false) == &from_u16(0), 1);
}

#[test]
fun test_boundary_values() {
    // Test positive boundary
    assert!(from_u16(0x7FFF) == new(32767, false), 1);

    // Test negative boundary
    assert!(from_u16(0x8000) == new(32768, true), 1);

    // Test -1
    assert!(from_u16(0xFFFF) == new(1, true), 1);
}
