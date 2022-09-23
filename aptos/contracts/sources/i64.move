module pyth::i64 {
    use pyth::error;
        
    const MAX_MAGNITUDE: u64 = (1 << 63) - 1;

    /// As Move does not support negative numbers natively, we use our own internal
    /// representation.
    struct I64 has copy, drop, store {
        negative: bool,
        magnitude: u64,
    }

    public fun new(magnitude: u64, negative: bool): I64 {
        assert!(magnitude <= MAX_MAGNITUDE, error::magnitude_too_large());

        I64 {
            magnitude: magnitude,
            negative: negative,
        }
    }

    public fun get_is_negative(i: &I64): bool {
        i.negative
    }

    public fun get_magnitude(in: &I64): u64 {
        in.magnitude
    }

    public fun get_magnitude_if_positive(in: &I64): u64 {
        assert!(!in.negative, error::negative_value());
        in.magnitude
    }

    public fun get_magnitude_if_negative(in: &I64): u64 {
        assert!(in.negative, error::positive_value());
        in.magnitude
    }

    public fun from_u64(from: u64): I64 {
        // Use the MSB to determine whether the number is negative or not.
        let negative = (from >> 63) == 1;
        return I64 {
            negative: negative,
            magnitude: parse_magnitude(from, negative),
        }
    }

    fun parse_magnitude(from: u64, negative: bool): u64 {
        // If positive, then return the input verbatamin
        if (!negative) {
            return from
        };

        // Otherwise convert from two's complement by inverting and adding 1
        let inverted = from ^ 0xFFFFFFFFFFFFFFFF;
        inverted + 1
    }

    #[test]
    #[expected_failure(abort_code = 65557)]
    fun test_magnitude_too_large() {
        new(0x8000000000000000, false);
    }

    #[test]
    fun test_from_u64_positive() {
        assert!(from_u64(0x64673) == new(0x64673, false), 1);
    }

    #[test]
    fun test_from_u64_negative() {
        assert!(from_u64(0xFFFFFFFFFFFEDC73) == new(0x1238D, true), 1);
    }

    #[test]
    fun test_get_is_negative() {
        assert!(get_is_negative(&new(234, true)) == true, 1);
        assert!(get_is_negative(&new(767, false)) == false, 1);
    }

    #[test]
    fun test_get_magnitude() {
        assert!(get_magnitude(&new(234, false)) == 234, 1);
    }

    #[test]
    fun test_get_magnitude_if_positive_positive() {
        assert!(get_magnitude_if_positive(&new(7686, false)) == 7686, 1);
    }

    #[test]
    #[expected_failure(abort_code = 196609)]
    fun test_get_magnitude_if_positive_negative() {
        assert!(get_magnitude_if_positive(&new(7686, true)) == 7686, 1);
    }

    #[test]
    fun test_get_magnitude_if_negative_negative() {
        assert!(get_magnitude_if_negative(&new(7686, true)) == 7686, 1);
    }

    #[test]
    #[expected_failure(abort_code = 196627)]
    fun test_get_magnitude_if_negative_positive() {
        assert!(get_magnitude_if_negative(&new(7686, false)) == 7686, 1);
    }

}
