use core::array::ArrayTrait;
use core::option::OptionTrait;
use pyth::util::{UNEXPECTED_OVERFLOW, UNEXPECTED_ZERO, one_shift_left_bytes_u128};
use super::byte_buffer::{ByteBuffer, ByteBufferImpl};

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum Error {
    UnexpectedEndOfInput,
}

impl ErrorIntoFelt252 of Into<Error, felt252> {
    fn into(self: Error) -> felt252 {
        match self {
            Error::UnexpectedEndOfInput => 'unexpected end of input',
        }
    }
}

/// Allows to read data from a byte array as big endian integers.
/// All methods return `EOF` error if attempted to
/// read more bytes than is available.
#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct Reader {
    // Input array.
    array: ByteBuffer,
    // Current value to read from (in big endian).
    current: u128,
    // Number of remaining bytes in `self.current`.
    num_current_bytes: u8,
    // Next value to read from (in big endian). This is needed because
    // `array.pop_front()` returns up to 31 bytes which require two u128 to store.
    next: Option<u128>,
}

impl DefaultReader of Default<Reader> {
    fn default() -> Reader {
        ReaderImpl::new(Default::default())
    }
}

#[generate_trait]
pub impl ReaderImpl of ReaderTrait {
    fn new(array: ByteBuffer) -> Reader {
        Reader { array, current: 0, num_current_bytes: 0, next: Option::None }
    }

    /// Reads the specified number of bytes (up to 16) as a big endian unsigned integer.
    fn read_num_bytes(ref self: Reader, num_bytes: u8) -> u128 {
        assert!(num_bytes <= 16, "Reader::read_num_bytes: num_bytes is too large");
        if num_bytes <= self.num_current_bytes {
            return self.read_from_current(num_bytes);
        }
        let num_low_bytes = num_bytes - self.num_current_bytes;
        let high = self.current;
        self.fetch_next();
        let low = self.read_num_bytes(num_low_bytes);
        if num_low_bytes == 16 {
            low
        } else {
            high * one_shift_left_bytes_u128(num_low_bytes) + low
        }
    }

    fn read_u256(ref self: Reader) -> u256 {
        let high = self.read_num_bytes(16);
        let low = self.read_num_bytes(16);
        let value = u256 { high, low };
        value
    }
    fn read_u160(ref self: Reader) -> u256 {
        let high = self.read_num_bytes(4);
        let low = self.read_num_bytes(16);
        u256 { high, low }
    }
    fn read_u128(ref self: Reader) -> u128 {
        self.read_num_bytes(16)
    }
    fn read_u64(ref self: Reader) -> u64 {
        self.read_num_bytes(8).try_into().expect(UNEXPECTED_OVERFLOW)
    }
    fn read_u32(ref self: Reader) -> u32 {
        self.read_num_bytes(4).try_into().expect(UNEXPECTED_OVERFLOW)
    }
    fn read_u16(ref self: Reader) -> u16 {
        self.read_num_bytes(2).try_into().expect(UNEXPECTED_OVERFLOW)
    }
    fn read_u8(ref self: Reader) -> u8 {
        self.read_num_bytes(1).try_into().expect(UNEXPECTED_OVERFLOW)
    }

    // TODO: skip without calculating values
    fn skip(ref self: Reader, mut num_bytes: usize) {
        while num_bytes > 0 {
            if num_bytes > 16 {
                self.read_num_bytes(16);
                num_bytes -= 16;
            } else {
                // num_bytes <= 16 so it shouldn't overflow.
                self.read_num_bytes(num_bytes.try_into().expect(UNEXPECTED_OVERFLOW));
                break;
            }
        }
    }

    /// Reads the specified number of bytes as a new byte array.
    fn read_byte_array(ref self: Reader, num_bytes: usize) -> ByteBuffer {
        let mut array: Array<felt252> = array![];
        let mut num_last_bytes = 0;
        let mut num_remaining_bytes = num_bytes;
        loop {
            let (num_read, eof) = self.read_bytes_iteration(num_remaining_bytes, ref array);
            num_remaining_bytes -= num_read;
            if eof {
                num_last_bytes = num_read;
                break;
            }
        }
        // num_last_bytes < 31
        let num_last_bytes = num_last_bytes.try_into().expect(UNEXPECTED_OVERFLOW);
        ByteBufferImpl::new(array, num_last_bytes)
    }

    /// Returns number of remaining bytes to read.
    fn len(ref self: Reader) -> usize {
        let num_next_bytes = if self.next.is_some() {
            16
        } else {
            0
        };
        self.num_current_bytes.into() + num_next_bytes + self.array.len()
    }
}

#[generate_trait]
impl ReaderPrivateImpl of ReaderPrivateTrait {
    /// Reads the specified number of bytes from `self.current`.
    /// Panics if attempted to read more than `self.num_current_bytes`.
    fn read_from_current(ref self: Reader, num_bytes: u8) -> u128 {
        let num_remaining_bytes = self.num_current_bytes - num_bytes;
        let divisor = one_shift_left_bytes_u128(num_remaining_bytes)
            .try_into()
            .expect(UNEXPECTED_ZERO);
        let (high, low) = DivRem::div_rem(self.current, divisor);
        self.current = low;
        self.num_current_bytes = num_remaining_bytes;
        high
    }

    /// Replenishes `self.current` and `self.num_current_bytes`.
    /// This should only be called when all bytes from `self.current` has been read.
    /// Returns `EOF` error if no more data is available.
    fn fetch_next(ref self: Reader) {
        match self.next {
            Option::Some(next) => {
                self.next = Option::None;
                self.current = next;
                self.num_current_bytes = 16;
            },
            Option::None => {
                let (value, bytes) = self
                    .array
                    .pop_front()
                    .expect(Error::UnexpectedEndOfInput.into());
                let value: u256 = value.into();
                if bytes > 16 {
                    self.current = value.high;
                    self.next = Option::Some(value.low);
                    self.num_current_bytes = bytes - 16;
                } else {
                    self.current = value.low;
                    self.num_current_bytes = bytes;
                }
            },
        }
    }

    // Moved out from `read_bytes` because we cannot use `return` or `?` within a loop.
    fn read_bytes_iteration(
        ref self: Reader, num_bytes: usize, ref array: Array<felt252>,
    ) -> (usize, bool) {
        if num_bytes >= 31 {
            let high = self.read_num_bytes(15);
            let low = self.read_num_bytes(16);
            let value: felt252 = u256 { high, low }.try_into().expect(UNEXPECTED_OVERFLOW);
            array.append(value);
            (31, false)
        } else if num_bytes > 16 {
            // num_bytes < 31
            let high = self.read_num_bytes((num_bytes - 16).try_into().expect(UNEXPECTED_OVERFLOW));
            let low = self.read_num_bytes(16);
            let value: felt252 = u256 { high, low }.try_into().expect(UNEXPECTED_OVERFLOW);
            array.append(value);
            (num_bytes, true)
        } else {
            // bytes < 16
            let low = self.read_num_bytes(num_bytes.try_into().expect(UNEXPECTED_OVERFLOW));
            let value: felt252 = low.try_into().expect(UNEXPECTED_OVERFLOW);
            array.append(value);
            (num_bytes, true)
        }
    }
}
