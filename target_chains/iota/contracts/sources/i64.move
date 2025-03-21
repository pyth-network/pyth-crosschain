module pyth::i64 {
    //use pyth::error;

    const MAX_POSITIVE_MAGNITUDE: u64 = (1 << 63) - 1;
    const MAX_NEGATIVE_MAGNITUDE: u64 = (1 << 63);

    /// As Move does not support negative numbers natively, we use our own internal
    /// representation.
    ///
    /// To consume these values, first call `get_is_negative()` to determine if the I64
    /// represents a negative or positive value. Then call `get_magnitude_if_positive()` or
    /// `get_magnitude_if_negative()` to get the magnitude of the number in unsigned u64 format.
    /// This API forces consumers to handle positive and negative numbers safely.
    struct I64 has copy, drop, store {
        negative: bool,
        magnitude: u64,
    }

    public fun new(magnitude: u64, negative: bool): I64 {
        let max_magnitude = MAX_POSITIVE_MAGNITUDE;
        if (negative) {
            max_magnitude = MAX_NEGATIVE_MAGNITUDE;
        };
        assert!(magnitude <= max_magnitude, 0); //error::magnitude_too_large()


        // Ensure we have a single zero representation: (0, false).
        // (0, true) is invalid.
        if (magnitude == 0) {
            negative = false;
        };

        I64 {
            magnitude,
            negative,
        }
    }

    public fun get_is_negative(i: &I64): bool {
        i.negative
    }

    public fun get_magnitude_if_positive(in: &I64): u64 {
        assert!(!in.negative, 0); // error::negative_value()
        in.magnitude
    }

    public fun get_magnitude_if_negative(in: &I64): u64 {
        assert!(in.negative, 0); //error::positive_value()
        in.magnitude
    }

    public fun from_u64(from: u64): I64 {
        // Use the MSB to determine whether the number is negative or not.
        let negative = (from >> 63) == 1;
        let magnitude = parse_magnitude(from, negative);

        new(magnitude, negative)
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
    fun test_max_positive_magnitude() {
        new(0x7FFFFFFFFFFFFFFF, false);
        assert!(&new(1<<63 - 1, false) == &from_u64(1<<63 - 1), 1);
    }

    #[test]
    #[expected_failure]
    fun test_magnitude_too_large_positive() {
        new(0x8000000000000000, false);
    }

    #[test]
    fun test_max_negative_magnitude() {
        new(0x8000000000000000, true);
        assert!(&new(1<<63, true) == &from_u64(1<<63), 1);
    }

    #[test]
    #[expected_failure]
    fun test_magnitude_too_large_negative() {
        new(0x8000000000000001, true);
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
        assert!(&new(0, true) == &from_u64(0), 1);
        assert!(&new(0, false) == &from_u64(0), 1);
    }
}
