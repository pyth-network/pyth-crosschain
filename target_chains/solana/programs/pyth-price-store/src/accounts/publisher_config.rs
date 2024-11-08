use {
    super::errors::ReadAccountError,
    bytemuck::{from_bytes, from_bytes_mut, Pod, Zeroable},
    std::mem::size_of,
};

/// Account Magic to avoid Account Confusiong
const FORMAT: u32 = 2258188348;

pub fn format_matches(data: &[u8]) -> bool {
    super::format(data).map_or(false, |f| f == FORMAT)
}

/// Publisher config stored in a PDA.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroable, Pod)]
#[repr(C, packed)]
pub struct PublisherConfig {
    /// Account magic to avoid account confusion.
    pub format: u32,
    /// The publisher this config is associated with.
    /// Always matches the pubkey used to derive the PDA pubkey.
    pub publisher: [u8; 32],
    /// The publisher's buffer account.
    pub buffer_account: [u8; 32],
}

pub const SIZE: usize = size_of::<PublisherConfig>();

pub fn read(data: &[u8]) -> Result<&PublisherConfig, ReadAccountError> {
    if data.len() < size_of::<PublisherConfig>() {
        return Err(ReadAccountError::DataTooShort);
    }
    let data: &PublisherConfig = from_bytes(&data[..size_of::<PublisherConfig>()]);
    if data.format != FORMAT {
        return Err(ReadAccountError::FormatMismatch);
    }
    Ok(data)
}

pub fn create(
    data: &mut [u8],
    publisher: [u8; 32],
    buffer_account: [u8; 32],
) -> Result<&mut PublisherConfig, ReadAccountError> {
    if data.len() < size_of::<PublisherConfig>() {
        return Err(ReadAccountError::DataTooShort);
    }
    let data: &mut PublisherConfig = from_bytes_mut(&mut data[..size_of::<PublisherConfig>()]);
    if data.format != 0 {
        return Err(ReadAccountError::AlreadyInitialized);
    }
    data.format = FORMAT;
    data.publisher = publisher;
    data.buffer_account = buffer_account;
    Ok(data)
}
