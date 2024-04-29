use core::fmt::{Debug, Formatter};

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
