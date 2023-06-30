 module pyth::deserialize {
    use wormhole::bytes::{Self};
    use wormhole::cursor::{Cursor};
    use pyth::i64::{Self, I64};
    #[test_only]
    use wormhole::cursor::{take_rest};

    #[test_only]
    use wormhole::cursor::{Self};

    public fun deserialize_vector(cur: &mut Cursor<u8>, n: u64): vector<u8> {
        bytes::take_bytes(cur, n)
    }

    public fun deserialize_u8(cur: &mut Cursor<u8>): u8 {
        bytes::take_u8(cur)
    }

    public fun deserialize_u16(cur: &mut Cursor<u8>): u16 {
        bytes::take_u16_be(cur)
    }

    public fun deserialize_u32(cur: &mut Cursor<u8>): u32 {
        bytes::take_u32_be(cur)
    }

    public fun deserialize_i32(cur: &mut Cursor<u8>): I64 {
        let deserialized = deserialize_u32(cur);
        // If negative, pad the value
        let negative = (deserialized >> 31) == 1;
        if (negative) {
            let padded = (0xFFFFFFFF << 32) + (deserialized as u64);
            i64::from_u64((padded as u64))
        } else {
            i64::from_u64((deserialized as u64))
        }
    }

    public fun deserialize_u64(cur: &mut Cursor<u8>): u64 {
        bytes::take_u64_be(cur)
    }

    public fun deserialize_i64(cur: &mut Cursor<u8>): I64 {
        i64::from_u64(deserialize_u64(cur))
    }

    #[test]
    fun test_deserialize_u8() {
        let input = x"48258963";
        let cursor = cursor::new(input);

        let result = deserialize_u8(&mut cursor);
        assert!(result == 0x48, 1);

        let rest = take_rest(cursor);
        assert!(rest == x"258963", 1);
    }

    #[test]
    fun test_deserialize_u16() {
        let input = x"48258963";
        let cursor = cursor::new(input);

        let result = deserialize_u16(&mut cursor);
        assert!(result == 0x4825, 1);

        let rest = take_rest(cursor);
        assert!(rest == x"8963", 1);
    }

    #[test]
    fun test_deserialize_u32() {
        let input = x"4825896349741695";
        let cursor = cursor::new(input);

        let result = deserialize_u32(&mut cursor);
        assert!(result == 0x48258963, 1);

        let rest = take_rest(cursor);
        assert!(rest == x"49741695", 1);
    }

    #[test]
    fun test_deserialize_i32_positive() {
        let input = x"4825896349741695";
        let cursor = cursor::new(input);

        let result = deserialize_i32(&mut cursor);
        assert!(result == i64::from_u64(0x48258963), 1);

        let rest = take_rest(cursor);
        assert!(rest == x"49741695", 1);
    }

    #[test]
    fun test_deserialize_i32_negative() {
        let input = x"FFFFFDC349741695";

        let cursor = cursor::new(input);

        let result = deserialize_i32(&mut cursor);
        assert!(result == i64::from_u64(0xFFFFFFFFFFFFFDC3), 1);

        let rest = take_rest(cursor);
        assert!(rest == x"49741695", 1);
    }

    #[test]
    fun test_deserialize_u64() {
        let input = x"48258963497416957497253486";
        let cursor = cursor::new(input);

        let result = deserialize_u64(&mut cursor);
        assert!(result == 0x4825896349741695, 1);

        let rest = take_rest(cursor);
        assert!(rest == x"7497253486", 1);
    }

    #[test]
    fun test_deserialize_i64_positive() {
        let input = x"48258963497416957497253486";
        let cursor = cursor::new(input);

        let result = deserialize_i64(&mut cursor);
        assert!(result == i64::from_u64(0x4825896349741695), 1);

        let rest = take_rest(cursor);
        assert!(rest == x"7497253486", 1);
    }

    #[test]
    fun test_deserialize_i64_negative() {
        let input = x"FFFFFFFFFFFFFDC37497253486";
        let cursor = cursor::new(input);

        let result = deserialize_i64(&mut cursor);
        assert!(result == i64::from_u64(0xFFFFFFFFFFFFFDC3), 1);

        let rest = take_rest(cursor);
        assert!(rest == x"7497253486", 1);
    }
}
