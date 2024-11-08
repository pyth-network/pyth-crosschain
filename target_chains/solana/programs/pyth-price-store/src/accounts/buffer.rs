use {
    super::errors::{ExtendError, PublisherPriceError, ReadAccountError},
    bytemuck::{cast_slice, from_bytes, from_bytes_mut, Pod, Zeroable},
    std::mem::size_of,
};

/// Account Magic to avoid Account Confusiong
const FORMAT: u32 = 2848712303;

/// A publisher's buffer account. This account acts as the buffer for storing prices sent
/// by publishers. It tracks the slot in which it is collecting in order
/// to allow the validator to stay in sync.
/// Not a PDA because it's not possible
/// to create a large (>10240 bytes) PDA, but owned by the publisher program.
/// The account's data is represented by a `BufferHeader` followed by
/// multiple `BufferedPrice`s.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroable, Pod)]
#[repr(C, packed)]
pub struct BufferHeader {
    /// Account magic to avoid account confusion.
    pub format: u32,
    /// The publisher this buffer is associated with.
    pub publisher: [u8; 32],
    /// The slot corresponding to all prices currently stored in the account.
    /// Determined by the clock value when `SubmitPrices` is called.
    pub slot: u64,
    /// The number of prices currently stored in the account.
    pub num_prices: u32,
}

impl BufferHeader {
    pub fn new(publisher: [u8; 32]) -> Self {
        BufferHeader {
            format: FORMAT,
            publisher,
            slot: 0,
            num_prices: 0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroable, Pod)]
#[repr(C, packed)]
pub struct BufferedPrice {
    // 4 high bits: trading status
    // 28 low bits: feed index
    pub trading_status_and_feed_index: u32,
    pub price: i64,
    pub confidence: u64,
}

impl BufferedPrice {
    pub fn new(
        feed_index: u32,
        trading_status: u32,
        price: i64,
        confidence: u64,
    ) -> Result<Self, PublisherPriceError> {
        if feed_index == 0 || feed_index >= (1 << 28) || trading_status >= (1 << 4) {
            return Err(PublisherPriceError);
        }
        Ok(Self {
            trading_status_and_feed_index: (trading_status << 28) | feed_index,
            price,
            confidence,
        })
    }

    pub fn trading_status(&self) -> u32 {
        self.trading_status_and_feed_index >> 28
    }

    pub fn feed_index(&self) -> u32 {
        self.trading_status_and_feed_index & ((1 << 28) - 1)
    }
}

/// Verifies the account magic.
pub fn format_matches(data: &[u8]) -> bool {
    super::format(data).map_or(false, |f| f == FORMAT)
}

/// Verifies the account size and header. Returns the header and the currently stored prices
/// (as indicated by the `num_prices` field in the header).
pub fn read(data: &[u8]) -> Result<(&BufferHeader, &[BufferedPrice]), ReadAccountError> {
    if data.len() < size_of::<BufferHeader>() {
        return Err(ReadAccountError::DataTooShort);
    }
    let header: &BufferHeader = from_bytes(&data[..size_of::<BufferHeader>()]);
    if header.format != FORMAT {
        return Err(ReadAccountError::FormatMismatch);
    }
    let prices_bytes = &data[size_of::<BufferHeader>()..];
    let num_prices: usize = header.num_prices.try_into().unwrap();
    let expected_len = num_prices.saturating_mul(size_of::<BufferedPrice>());
    if expected_len > prices_bytes.len() {
        return Err(ReadAccountError::InvalidNumPrices);
    }
    // We don't validate the values of `new_prices` to make the publishing process
    // more efficient. They will be validated when applied in the validator.
    let prices = cast_slice(&prices_bytes[..expected_len]);
    Ok((header, prices))
}

/// Returns the buffer size required to hold the specified number of prices.
pub fn size(max_prices: usize) -> usize {
    size_of::<BufferHeader>() + max_prices * size_of::<BufferedPrice>()
}

/// Verifies the account size and header. Returns the header and the remaining buffer space.
/// The remaining space may contain some prices, as indicated by the `num_prices` field in the header.
pub fn read_mut(data: &mut [u8]) -> Result<(&mut BufferHeader, &mut [u8]), ReadAccountError> {
    if data.len() < size_of::<BufferHeader>() {
        return Err(ReadAccountError::DataTooShort);
    }
    let (header, prices) = data.split_at_mut(size_of::<BufferHeader>());
    let header: &mut BufferHeader = from_bytes_mut(header);
    if header.format != FORMAT {
        return Err(ReadAccountError::FormatMismatch);
    }
    Ok((header, prices))
}

/// Initializes the buffer. Returns the header and the remaining buffer space.
pub fn create(
    data: &mut [u8],
    publisher: [u8; 32],
) -> Result<(&mut BufferHeader, &mut [u8]), ReadAccountError> {
    if data.len() < size_of::<BufferHeader>() {
        return Err(ReadAccountError::DataTooShort);
    }
    let (header, prices) = data.split_at_mut(size_of::<BufferHeader>());
    let header: &mut BufferHeader = from_bytes_mut(header);
    if header.format != 0 {
        return Err(ReadAccountError::AlreadyInitialized);
    }
    *header = BufferHeader::new(publisher);
    Ok((header, prices))
}

/// Removes prices for the other slot from the buffer (if any) and adds new prices.
pub fn update(
    header: &mut BufferHeader,
    prices: &mut [u8],
    current_slot: u64,
    new_prices: &[u8],
) -> Result<(), ExtendError> {
    if new_prices.len() % size_of::<BufferedPrice>() != 0 {
        return Err(ExtendError::InvalidLength);
    }
    // We expect the validator to apply the buffered prices at the end of each slot,
    // so when we observe a new slot we remove previously stored prices.
    if header.slot != current_slot {
        header.slot = current_slot;
        header.num_prices = 0;
    }
    let num_new_prices = (new_prices.len() / size_of::<BufferedPrice>())
        .try_into()
        .expect("unexpected overflow");
    let num_prices: usize = header.num_prices.try_into().unwrap();
    let start = size_of::<BufferedPrice>() * num_prices;
    let end = size_of::<BufferedPrice>() * num_prices + new_prices.len();
    header.num_prices = header
        .num_prices
        .checked_add(num_new_prices)
        .expect("unexpected overflow");

    let destination = prices
        .get_mut(start..end)
        .ok_or(ExtendError::NotEnoughSpace)?;

    // We don't validate the values of `new_prices` to make the publishing process
    // more efficient. They will be validated when applied in the validator.
    #[cfg(feature = "solana-program")]
    solana_program::program_memory::sol_memcpy(destination, new_prices, new_prices.len());
    #[cfg(not(feature = "solana-program"))]
    destination.copy_from_slice(new_prices);
    Ok(())
}

#[test]
fn test_recommended_size() {
    // Recommended buffer size, enough to hold 5000 prices.
    assert_eq!(size(5000), 100048);
}

#[test]
fn test_extend_clears_old_prices() {
    let mut buf = vec![0u8; size(30)];
    create(&mut buf, Default::default()).unwrap();
    assert!(read(&buf).unwrap().1.is_empty());
    {
        let (header, prices) = read_mut(&mut buf).unwrap();
        update(header, prices, 1, &vec![1; 40]).unwrap();
    }
    assert_eq!(read(&buf).unwrap().1.len(), 2);
    {
        let (header, prices) = read_mut(&mut buf).unwrap();
        update(header, prices, 1, &vec![1; 60]).unwrap();
    }
    assert_eq!(read(&buf).unwrap().1.len(), 5);
    {
        let (header, prices) = read_mut(&mut buf).unwrap();
        update(header, prices, 2, &vec![1; 60]).unwrap();
    }
    assert_eq!(read(&buf).unwrap().1.len(), 3);
}
