use {
    super::errors::ReadAccountError,
    bytemuck::{from_bytes, from_bytes_mut, Pod, Zeroable},
    std::mem::size_of,
};

/// Account Magic to avoid Account Confusiong
const FORMAT: u32 = 1505352794;

pub fn format_matches(data: &[u8]) -> bool {
    super::format(data).map_or(false, |f| f == FORMAT)
}

/// Global config of the program stored in a PDA.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroable, Pod)]
#[repr(C, packed)]
pub struct Config {
    /// Account magic to avoid account confusion.
    pub format: u32,
    /// The signature of the authority account will be required to execute
    /// `InitializePublisher` instruction.
    pub authority: [u8; 32],
}

pub const SIZE: usize = size_of::<Config>();

pub fn read(data: &[u8]) -> Result<&Config, ReadAccountError> {
    if data.len() < size_of::<Config>() {
        return Err(ReadAccountError::DataTooShort);
    }
    let data: &Config = from_bytes(&data[..size_of::<Config>()]);
    if data.format != FORMAT {
        return Err(ReadAccountError::FormatMismatch);
    }
    Ok(data)
}

pub fn create(data: &mut [u8], authority: [u8; 32]) -> Result<&mut Config, ReadAccountError> {
    if data.len() < size_of::<Config>() {
        return Err(ReadAccountError::DataTooShort);
    }
    let data: &mut Config = from_bytes_mut(&mut data[..size_of::<Config>()]);
    if data.format != 0 {
        return Err(ReadAccountError::AlreadyInitialized);
    }
    data.format = FORMAT;
    data.authority = authority;
    Ok(data)
}
