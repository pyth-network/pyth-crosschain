use core::option::OptionTrait;
use core::array::ArrayTrait;
use core::keccak::cairo_keccak;
use core::integer::u128_byte_reverse;
use core::fmt::{Debug, Formatter};

pub const EOF: felt252 = 'unexpected end of input';
pub const UNEXPECTED_OVERFLOW: felt252 = 'unexpected overflow';

/// A byte array with storage format similar to `core::ByteArray`, but
/// suitable for reading data from it.
#[derive(Drop, Clone, Serde)]
pub struct ByteArray {
    // Number of bytes stored in the last item of `self.data` (or 0 if it's empty).
    num_last_bytes: u8,
    // Bytes in big endian. Each item except the last one stores 31 bytes.
    // If `num_last_bytes < 31`, unused most significant bytes of the last item will be unused.
    data: Array<bytes31>,
}

impl DebugByteArray of Debug<ByteArray> {
    fn fmt(self: @ByteArray, ref f: Formatter) -> Result<(), core::fmt::Error> {
        write!(f, "ByteArray {{ num_last_bytes: {}, data: [", self.num_last_bytes)?;
        let mut data = self.data.clone();
        loop {
            match data.pop_front() {
                Option::Some(v) => {
                    let v: u256 = v.into();
                    write!(f, "{:?}, ", v).unwrap();
                },
                Option::None => { break; },
            }
        };
        write!(f, "]}}")
    }
}

#[generate_trait]
pub impl ByteArrayImpl of ByteArrayTrait {
    /// Creates a byte array with the data.
    fn new(data: Array<bytes31>, num_last_bytes: u8) -> ByteArray {
        if data.len() == 0 {
            assert!(num_last_bytes == 0);
        } else {
            assert!(num_last_bytes <= 31);
        // TODO: check that unused bytes are zeroed.
        }
        ByteArray { num_last_bytes, data }
    }

    /// Removes 31 or less bytes from the start of the array.
    /// Returns the value and the number of bytes.
    fn pop_front(ref self: ByteArray) -> Option<(bytes31, u8)> {
        let item = self.data.pop_front()?;
        if self.data.is_empty() {
            let num_bytes = self.num_last_bytes;
            self.num_last_bytes = 0;
            Option::Some((item, num_bytes))
        } else {
            Option::Some((item, 31))
        }
    }

    fn len(self: @ByteArray) -> usize {
        if self.data.is_empty() {
            0
        } else {
            (self.data.len() - 1) * 31 + (*self.num_last_bytes).into()
        }
    }
}

/// Allows to read data from a byte array.
/// Uses big endian unless specified otherwise.
/// All methods return `EOF` error if attempted to
/// read more bytes than is available.
#[derive(Drop, Clone)]
pub struct Reader {
    // Input array.
    array: ByteArray,
    // Current value to read from (in big endian).
    current: u128,
    // Number of remaining bytes in `self.current`.
    num_current_bytes: u8,
    // Next value to read from (in big endian). This is needed because
    // `array.pop_front()` returns up to 31 bytes which require two u128 to store.
    next: Option<u128>,
}

#[generate_trait]
pub impl ReaderImpl of ReaderTrait {
    fn new(array: ByteArray) -> Reader {
        Reader { array, current: 0, num_current_bytes: 0, next: Option::None }
    }

    /// Reads the specified number of bytes (up to 16) as a big endian unsigned integer.
    fn read(ref self: Reader, num_bytes: u8) -> Result<u128, felt252> {
        if num_bytes <= self.num_current_bytes {
            let x = self.read_from_current(num_bytes);
            return Result::Ok(x);
        }
        let num_low_bytes = num_bytes - self.num_current_bytes;
        let high = self.current;
        self.fetch_next()?;
        let low = self.read(num_low_bytes)?;
        let value = if num_low_bytes == 16 {
            low
        } else {
            high * one_shift_left_bytes_u128(num_low_bytes) + low
        };
        Result::Ok(value)
    }

    fn read_u256(ref self: Reader) -> Result<u256, felt252> {
        let high = self.read(16)?;
        let low = self.read(16)?;
        let value = u256 { high, low };
        Result::Ok(value)
    }
    fn read_u128(ref self: Reader) -> Result<u128, felt252> {
        self.read(16)
    }
    fn read_u64(ref self: Reader) -> Result<u64, felt252> {
        let value = self.read(8)?.try_into().expect(UNEXPECTED_OVERFLOW);
        Result::Ok(value)
    }
    fn read_u32(ref self: Reader) -> Result<u32, felt252> {
        let value = self.read(4)?.try_into().expect(UNEXPECTED_OVERFLOW);
        Result::Ok(value)
    }
    fn read_u16(ref self: Reader) -> Result<u16, felt252> {
        let value = self.read(2)?.try_into().expect(UNEXPECTED_OVERFLOW);
        Result::Ok(value)
    }
    fn read_u8(ref self: Reader) -> Result<u8, felt252> {
        let value = self.read(1)?.try_into().expect(UNEXPECTED_OVERFLOW);
        Result::Ok(value)
    }

    // TODO: skip without calculating values
    fn skip(ref self: Reader, mut num_bytes: u8) -> Result<(), felt252> {
        let mut result = Result::Ok(());
        while num_bytes > 0 {
            if num_bytes > 16 {
                match self.read(16) {
                    Result::Ok(_) => {},
                    Result::Err(err) => {
                        result = Result::Err(err);
                        break;
                    }
                }
                num_bytes -= 16;
            } else {
                match self.read(num_bytes) {
                    Result::Ok(_) => {},
                    Result::Err(err) => {
                        result = Result::Err(err);
                        break;
                    }
                }
                break;
            }
        };
        result
    }

    /// Reads the specified number of bytes as a new byte array.
    fn read_bytes(ref self: Reader, num_bytes: usize) -> Result<ByteArray, felt252> {
        let mut array: Array<bytes31> = array![];
        let mut num_last_bytes = Option::None;
        let mut num_remaining_bytes = num_bytes;
        loop {
            let r = self.read_bytes_iteration(num_remaining_bytes, ref array);
            match r {
                Result::Ok((
                    num_read, eof
                )) => {
                    num_remaining_bytes -= num_read;
                    if eof {
                        num_last_bytes = Option::Some(Result::Ok(num_read));
                        break;
                    }
                },
                Result::Err(err) => {
                    num_last_bytes = Option::Some(Result::Err(err));
                    break;
                }
            }
        };
        // `num_last_bytes` is always set to Some before break.
        let num_last_bytes = num_last_bytes.unwrap()?;
        // num_last_bytes < 31
        let num_last_bytes = num_last_bytes.try_into().expect(UNEXPECTED_OVERFLOW);
        let array = ByteArrayImpl::new(array, num_last_bytes);
        Result::Ok(array)
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

    /// Reads the specified number of bytes (up to 16) as a little endian unsigned integer.
    fn read_le(ref self: Reader, num_bytes: u8) -> Result<u128, felt252> {
        if num_bytes == 0 {
            return Result::Ok(0);
        }
        let value = u128_byte_reverse(self.read(num_bytes)?)
            / one_shift_left_bytes_u128(16 - num_bytes);
        Result::Ok(value)
    }

    /// Reads and hashes all the remaining data.
    fn keccak256(ref self: Reader) -> Result<u256, felt252> {
        let mut data: Array<u64> = array![];

        let mut result = Result::Ok(());
        while self.len() >= 8 {
            match self.read_le(8) {
                Result::Ok(value) => { data.append(value.try_into().expect(UNEXPECTED_OVERFLOW)); },
                Result::Err(err) => {
                    result = Result::Err(err);
                    break;
                },
            }
        };
        result?;

        let last_len = self.len();
        // last_len < 8
        let last = self.read_le(last_len.try_into().expect(UNEXPECTED_OVERFLOW))?;
        let last = last.try_into().expect(UNEXPECTED_OVERFLOW);
        let hash = cairo_keccak(ref data, last, last_len);
        Result::Ok(hash)
    }
}

#[generate_trait]
impl ReaderPrivateImpl of ReaderPrivateTrait {
    /// Reads the specified number of bytes from `self.current`.
    /// Panics if attempted to read more than `self.num_current_bytes`.
    fn read_from_current(ref self: Reader, num_bytes: u8) -> u128 {
        let num_remaining_bytes = self.num_current_bytes - num_bytes;
        let divisor = one_shift_left_bytes_u128(num_remaining_bytes);
        // divisor != 0
        let (high, low) = DivRem::div_rem(self.current, divisor.try_into().unwrap());
        self.current = low;
        self.num_current_bytes = num_remaining_bytes;
        high
    }

    /// Replenishes `self.current` and `self.num_current_bytes`.
    /// This should only be called when all bytes from `self.current` has been read.
    /// Returns `EOF` error if no more data is available.
    fn fetch_next(ref self: Reader) -> Result<(), felt252> {
        match self.next {
            Option::Some(next) => {
                self.next = Option::None;
                self.current = next;
                self.num_current_bytes = 16;
            },
            Option::None => {
                let (value, bytes) = self.array.pop_front().ok_or(EOF)?;
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
        Result::Ok(())
    }

    // Moved out from `read_bytes` because we cannot use `return` or `?` within a loop.
    fn read_bytes_iteration(
        ref self: Reader, num_bytes: usize, ref array: Array<bytes31>
    ) -> Result<(usize, bool), felt252> {
        if num_bytes >= 31 {
            let high = self.read(15)?;
            let low = self.read(16)?;
            let value: felt252 = u256 { high, low }.try_into().expect(UNEXPECTED_OVERFLOW);
            array.append(value.try_into().expect(UNEXPECTED_OVERFLOW));
            Result::Ok((31, false))
        } else if num_bytes > 16 {
            // num_bytes < 31
            let high = self.read((num_bytes - 16).try_into().expect(UNEXPECTED_OVERFLOW))?;
            let low = self.read(16)?;
            let value: felt252 = u256 { high, low }.try_into().expect(UNEXPECTED_OVERFLOW);
            array.append(value.try_into().expect(UNEXPECTED_OVERFLOW));
            Result::Ok((num_bytes, true))
        } else {
            // bytes < 16
            let low = self.read(num_bytes.try_into().expect(UNEXPECTED_OVERFLOW))?;
            let value: felt252 = low.try_into().expect(UNEXPECTED_OVERFLOW);
            array.append(value.try_into().expect(UNEXPECTED_OVERFLOW));
            Result::Ok((num_bytes, true))
        }
    }
}

// Returns 1 << (8 * `n_bytes`) as u128, where `n_bytes` must be < BYTES_IN_U128.
//
// Panics if `n_bytes >= 16`.
fn one_shift_left_bytes_u128(n_bytes: u8) -> u128 {
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
