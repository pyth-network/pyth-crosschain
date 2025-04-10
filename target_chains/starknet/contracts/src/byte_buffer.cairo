use core::array::ArrayTrait;
use core::fmt::{Debug, Formatter};
use super::util::one_shift_left_bytes_u256;

/// A byte array with storage format similar to `core::ByteArray`, but
/// suitable for reading data from it.
#[derive(Drop, Clone, PartialEq, Serde)]
pub struct ByteBuffer {
    // Number of bytes stored in the last item of `self.data` (or 0 if it's empty).
    num_last_bytes: u8,
    // Bytes in big endian. Each item except the last one stores 31 bytes.
    // If `num_last_bytes < 31`, unused most significant bytes of the last item will be unused.
    data: Array<felt252>,
}

impl DebugByteBuffer of Debug<ByteBuffer> {
    fn fmt(self: @ByteBuffer, ref f: Formatter) -> Result<(), core::fmt::Error> {
        write!(f, "ByteBuffer {{ num_last_bytes: {}, data: [", self.num_last_bytes)?;
        let mut data = self.data.clone();
        loop {
            match data.pop_front() {
                Option::Some(v) => { write!(f, "{:?}, ", v).unwrap(); },
                Option::None => { break; },
            }
        }
        write!(f, "]}}")
    }
}

impl DefaultByteBuffer of Default<ByteBuffer> {
    fn default() -> ByteBuffer {
        ByteBufferImpl::new(array![], 0)
    }
}

#[generate_trait]
pub impl ByteBufferImpl of ByteBufferTrait {
    /// Creates a byte array with the data.
    fn new(data: Array<felt252>, num_last_bytes: u8) -> ByteBuffer {
        if data.len() == 0 {
            assert!(num_last_bytes == 0);
        } else {
            assert!(num_last_bytes > 0);
            assert!(num_last_bytes <= 31);
            let last: u256 = (*data.at(data.len() - 1)).into();
            assert!(
                last / one_shift_left_bytes_u256(num_last_bytes) == 0,
                "ByteBufferImpl::new: last value is too large",
            );
        }
        ByteBuffer { num_last_bytes, data }
    }

    /// Removes 31 or less bytes from the start of the array.
    /// Returns the value and the number of bytes.
    fn pop_front(ref self: ByteBuffer) -> Option<(felt252, u8)> {
        let item = self.data.pop_front()?;
        if self.data.is_empty() {
            let num_bytes = self.num_last_bytes;
            self.num_last_bytes = 0;
            Option::Some((item, num_bytes))
        } else {
            Option::Some((item, 31))
        }
    }

    fn len(self: @ByteBuffer) -> usize {
        if self.data.is_empty() {
            0
        } else {
            (self.data.len() - 1) * 31 + (*self.num_last_bytes).into()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ByteBufferImpl;

    #[test]
    fn empty_byte_array() {
        let mut array = ByteBufferImpl::new(array![], 0);
        assert!(array.len() == 0);
        assert!(array.pop_front() == Option::None);
    }

    #[test]
    fn byte_array_3_zeros() {
        let mut array = ByteBufferImpl::new(array![0], 3);
        assert!(array.len() == 3);
        assert!(array.pop_front() == Option::Some((0, 3)));
        assert!(array.len() == 0);
        assert!(array.pop_front() == Option::None);
    }

    #[test]
    fn byte_array_3_bytes() {
        let mut array = ByteBufferImpl::new(array![0x010203], 3);
        assert!(array.len() == 3);
        assert!(array.pop_front() == Option::Some((0x010203, 3)));
        assert!(array.len() == 0);
        assert!(array.pop_front() == Option::None);
    }

    #[test]
    fn byte_array_single_full() {
        let value_31_bytes = 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f;
        let mut array = ByteBufferImpl::new(array![value_31_bytes], 31);
        assert!(array.len() == 31);
        assert!(array.pop_front() == Option::Some((value_31_bytes, 31)));
        assert!(array.len() == 0);
        assert!(array.pop_front() == Option::None);
    }

    #[test]
    fn byte_array_two_full() {
        let value_31_bytes = 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f;
        let value2_31_bytes = 0x2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f;
        let mut array = ByteBufferImpl::new(array![value_31_bytes, value2_31_bytes], 31);
        assert!(array.len() == 62);
        assert!(array.pop_front() == Option::Some((value_31_bytes, 31)));
        assert!(array.len() == 31);
        assert!(array.pop_front() == Option::Some((value2_31_bytes, 31)));
        assert!(array.len() == 0);
        assert!(array.pop_front() == Option::None);
    }

    #[test]
    fn byte_array_3_items() {
        let value_31_bytes = 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f;
        let value2_31_bytes = 0x2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f;
        let value3_5_bytes = 0x4142434445;
        let mut array = ByteBufferImpl::new(
            array![value_31_bytes, value2_31_bytes, value3_5_bytes], 5,
        );
        assert!(array.len() == 67);
        assert!(array.pop_front() == Option::Some((value_31_bytes, 31)));
        assert!(array.len() == 36);
        assert!(array.pop_front() == Option::Some((value2_31_bytes, 31)));
        assert!(array.len() == 5);
        assert!(array.pop_front() == Option::Some((value3_5_bytes, 5)));
        assert!(array.pop_front() == Option::None);
    }

    #[test]
    #[should_panic]
    fn byte_array_empty_invalid() {
        ByteBufferImpl::new(array![], 5);
    }

    #[test]
    #[should_panic]
    fn byte_array_last_too_large() {
        ByteBufferImpl::new(array![1, 2, 3], 35);
    }

    #[test]
    #[should_panic]
    fn byte_array_last_zero_invalid() {
        ByteBufferImpl::new(array![1, 2, 0], 0);
    }

    #[test]
    #[should_panic]
    fn byte_array_last_too_many_bytes() {
        ByteBufferImpl::new(array![1, 2, 0x010203], 2);
    }
}
