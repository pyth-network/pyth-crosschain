use core::cmp::min;
use core::integer::u128_byte_reverse;
use pyth::util::{
    ONE_SHIFT_160, ONE_SHIFT_64, UNEXPECTED_OVERFLOW, UNEXPECTED_ZERO, one_shift_left_bytes_u64,
    u64_byte_reverse,
};
use super::reader::{Reader, ReaderImpl};

/// Allows to push data as big endian to a buffer and apply
/// the keccak256 hash.
#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct Hasher {
    // Inputs in little endian.
    inputs_le: Array<u64>,
    // Last pushed bytes in big endian.
    last_be: u64,
    // Number of filled bytes in `self.last_be`.
    num_last_bytes: u8,
}

#[generate_trait]
pub impl HasherImpl of HasherTrait {
    /// Creates an empty hasher.
    fn new() -> Hasher {
        Hasher { inputs_le: array![], last_be: 0, num_last_bytes: 0 }
    }

    fn push_u8(ref self: Hasher, value: u8) {
        self.push_to_last(value.into(), 1);
    }
    fn push_u16(ref self: Hasher, value: u16) {
        self.push_num_bytes(value.into(), 2);
    }
    fn push_u32(ref self: Hasher, value: u32) {
        self.push_num_bytes(value.into(), 4);
    }
    fn push_u64(ref self: Hasher, value: u64) {
        self.push_num_bytes(value, 8);
    }
    fn push_u128(ref self: Hasher, value: u128) {
        let divisor = ONE_SHIFT_64.try_into().expect(UNEXPECTED_ZERO);
        let (high, low) = DivRem::div_rem(value, divisor);
        self.push_u64(high.try_into().expect(UNEXPECTED_OVERFLOW));
        self.push_u64(low.try_into().expect(UNEXPECTED_OVERFLOW));
    }
    fn push_u160(ref self: Hasher, value: u256) {
        assert!(value / ONE_SHIFT_160 == 0, "u160 value too big");
        self.push_num_bytes(value.high.try_into().expect(UNEXPECTED_OVERFLOW), 4);
        self.push_u128(value.low);
    }
    fn push_u256(ref self: Hasher, value: u256) {
        self.push_u128(value.high);
        self.push_u128(value.low);
    }

    /// Reads all remaining data from the reader and pushes it to
    /// the hashing buffer.
    fn push_reader(ref self: Hasher, ref reader: Reader) {
        while reader.len() > 0 {
            let mut chunk_len = 8 - self.num_last_bytes;
            if reader.len() < chunk_len.into() {
                // reader.len() < 8
                chunk_len = reader.len().try_into().expect(UNEXPECTED_OVERFLOW);
            }
            let value = reader.read_num_bytes(chunk_len);
            // chunk_len <= 8 so value must fit in u64.
            self.push_to_last(value.try_into().expect(UNEXPECTED_OVERFLOW), chunk_len);
        }
    }

    /// Returns the keccak256 hash of the buffer. The output hash is interpreted
    /// as a big endian unsigned integer.
    fn finalize(ref self: Hasher) -> u256 {
        let last_le = if self.num_last_bytes == 0 {
            0
        } else {
            u64_byte_reverse(self.last_be) / one_shift_left_bytes_u64(8 - self.num_last_bytes)
        };
        let hash_le = core::keccak::cairo_keccak(
            ref self.inputs_le, last_le, self.num_last_bytes.into(),
        );
        u256 { low: u128_byte_reverse(hash_le.high), high: u128_byte_reverse(hash_le.low) }
    }
}

#[generate_trait]
impl HasherPrivateImpl of HasherPrivateTrait {
    // Adds specified number of bytes to the buffer.
    fn push_num_bytes(ref self: Hasher, value: u64, num_bytes: u8) {
        assert!(num_bytes <= 8, "num_bytes too high in Hasher::push_num_bytes");
        if num_bytes != 8 {
            assert!(
                value / one_shift_left_bytes_u64(num_bytes) == 0,
                "Hasher::push_num_bytes: value is too large",
            );
        }
        let num_high_bytes = min(num_bytes, 8 - self.num_last_bytes);
        let num_low_bytes = num_bytes - num_high_bytes;
        let divisor = one_shift_left_bytes_u64(num_low_bytes).try_into().expect(UNEXPECTED_ZERO);
        let (high, low) = DivRem::div_rem(value, divisor);
        self.push_to_last(high, num_high_bytes);
        self.push_to_last(low, num_low_bytes);
    }

    fn push_to_last(ref self: Hasher, value: u64, num_bytes: u8) {
        assert!(num_bytes <= 8 - self.num_last_bytes, "num_bytes too high in Hasher::push_to_last");
        if num_bytes != 8 {
            assert!(
                value / one_shift_left_bytes_u64(num_bytes) == 0,
                "Hasher::push_to_last: value is too large",
            );
        }
        if num_bytes == 8 {
            self.last_be = value;
        } else {
            self.last_be = self.last_be * one_shift_left_bytes_u64(num_bytes) + value;
        }
        self.num_last_bytes += num_bytes;
        if self.num_last_bytes == 8 {
            self.inputs_le.append(u64_byte_reverse(self.last_be));
            self.last_be = 0;
            self.num_last_bytes = 0;
        }
    }
}
