//! The PublisherPrices account acts as the buffer for storing prices sent
//! by publishers. It tracks the slot in which it is collecting in order
//! to allow the validator to stay in sync.

use {
    bytemuck::{
        cast_slice,
        from_bytes,
        from_bytes_mut,
        Pod,
        Zeroable,
    },
    solana_program::clock::Slot,
    std::mem::size_of,
    thiserror::Error,
};

/// Account Magic to avoid Account Confusiong
const FORMAT: u32 = 2848712303;

#[derive(Debug, Clone, Copy, Zeroable, Pod)]
#[repr(C, packed)]
pub struct PublisherPricesHeader {
    pub format:     u32,
    pub publisher:  [u8; 32],
    pub slot:       Slot,
    pub num_prices: u32,
}

impl PublisherPricesHeader {
    pub fn new(publisher: [u8; 32]) -> Self {
        PublisherPricesHeader {
            format: FORMAT,
            publisher,
            slot: 0,
            num_prices: 0,
        }
    }
}

#[derive(Debug, Clone, Copy, Zeroable, Pod)]
#[repr(C, packed)]
pub struct PublisherPrice {
    // 4 high bits: trading status
    // 28 low bits: feed index
    pub trading_status_and_feed_index: u32,
    pub price:                         i64,
    pub confidence:                    u64,
}

#[derive(Debug, Error)]
#[error("publisher price data overflow")]
pub struct PublisherPriceError;

impl PublisherPrice {
    pub fn new(
        feed_index: u32,
        trading_status: u32,
        price: i64,
        confidence: u64,
    ) -> Result<Self, PublisherPriceError> {
        if feed_index >= (1 << 28) || trading_status >= (1 << 4) {
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

#[derive(Debug, Error)]
pub enum ReadAccountError {
    #[error("data too short")]
    DataTooShort,
    #[error("format mismatch")]
    FormatMismatch,
    #[error("invalid num prices")]
    InvalidNumPrices,
}

#[derive(Debug, Error)]
pub enum ExtendError {
    #[error("not enough space")]
    NotEnoughSpace,
    #[error("invalid length")]
    InvalidLength,
}

pub fn read(data: &[u8]) -> Result<(&PublisherPricesHeader, &[PublisherPrice]), ReadAccountError> {
    if data.len() < size_of::<PublisherPricesHeader>() {
        return Err(ReadAccountError::DataTooShort);
    }
    let header: &PublisherPricesHeader = from_bytes(&data[..size_of::<PublisherPricesHeader>()]);
    if header.format != FORMAT {
        return Err(ReadAccountError::FormatMismatch);
    }
    let prices_bytes = &data[size_of::<PublisherPricesHeader>()..];
    let num_prices: usize = header.num_prices.try_into().unwrap();
    let expected_len = num_prices.saturating_mul(size_of::<PublisherPrice>());
    if expected_len > prices_bytes.len() {
        return Err(ReadAccountError::InvalidNumPrices);
    }
    let prices = cast_slice(&prices_bytes[..expected_len]);
    Ok((header, prices))
}

pub fn size(max_prices: usize) -> usize {
    size_of::<PublisherPricesHeader>() + max_prices * size_of::<PublisherPrice>()
}

pub fn read_mut(
    data: &mut [u8],
) -> Result<(&mut PublisherPricesHeader, &mut [u8]), ReadAccountError> {
    if data.len() < size_of::<PublisherPricesHeader>() {
        return Err(ReadAccountError::DataTooShort);
    }
    let (header, prices) = data.split_at_mut(size_of::<PublisherPricesHeader>());
    let header: &mut PublisherPricesHeader = from_bytes_mut(header);
    if header.format != FORMAT {
        return Err(ReadAccountError::FormatMismatch);
    }
    Ok((header, prices))
}

pub fn create(
    data: &mut [u8],
    publisher: [u8; 32],
) -> Result<(&mut PublisherPricesHeader, &mut [u8]), ReadAccountError> {
    if data.len() < size_of::<PublisherPricesHeader>() {
        return Err(ReadAccountError::DataTooShort);
    }
    let (header, prices) = data.split_at_mut(size_of::<PublisherPricesHeader>());
    let header: &mut PublisherPricesHeader = from_bytes_mut(header);
    *header = PublisherPricesHeader::new(publisher);
    Ok((header, prices))
}

pub fn extend(
    header: &mut PublisherPricesHeader,
    prices: &mut [u8],
    new_prices: &[u8],
) -> Result<(), ExtendError> {
    if new_prices.len() % size_of::<PublisherPrice>() != 0 {
        return Err(ExtendError::InvalidLength);
    }
    let num_new_prices = (new_prices.len() / size_of::<PublisherPrice>())
        .try_into()
        .expect("unexpected overflow");
    let num_prices: usize = header.num_prices.try_into().unwrap();
    let start = size_of::<PublisherPrice>() * num_prices;
    let end = size_of::<PublisherPrice>() * num_prices + new_prices.len();
    header.num_prices = header
        .num_prices
        .checked_add(num_new_prices)
        .expect("unexpected overflow");
    prices
        .get_mut(start..end)
        .ok_or(ExtendError::NotEnoughSpace)?
        .copy_from_slice(new_prices);
    Ok(())
}
