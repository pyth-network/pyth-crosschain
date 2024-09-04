use bytemuck::{from_bytes, from_bytes_mut, Pod, Zeroable};
use std::mem::size_of;

use super::errors::ReadAccountError;

/// Account Magic to avoid Account Confusiong
const FORMAT: u32 = 1505352794;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroable, Pod)]
#[repr(C, packed)]
pub struct Config {
    pub format: u32,
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
