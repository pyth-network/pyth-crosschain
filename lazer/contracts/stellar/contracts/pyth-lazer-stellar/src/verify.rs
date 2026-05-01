use soroban_sdk::{Bytes, BytesN, Env};

use crate::bytes::{get_byte, get_byte_n};
use crate::error::ContractError;
use crate::state;

/// LE-ECDSA format magic number (LE u32 = 0x4D47BDE4 = 1296547300).
const LE_ECDSA_FORMAT_MAGIC: u32 = 1_296_547_300;

/// Minimum envelope size: 4 (magic) + 64 (sig) + 1 (recovery_id) + 2 (payload_len) = 71 bytes.
const MIN_ENVELOPE_SIZE: u32 = 71;

/// Parse and verify an LE-ECDSA signed update message.
///
/// Wire format:
/// - 4 bytes: magic (LE u32)
/// - 64 bytes: ECDSA signature (r || s)
/// - 1 byte: recovery_id
/// - 2 bytes: payload_length (LE u16)
/// - N bytes: payload
///
/// Returns the verified payload bytes.
pub fn verify_update(env: &Env, data: &Bytes) -> Result<Bytes, ContractError> {
    let len = data.len();
    if len < MIN_ENVELOPE_SIZE {
        return Err(ContractError::TruncatedData);
    }

    // Parse magic (LE u32)
    let magic = read_le_u32(data, 0)?;
    if magic != LE_ECDSA_FORMAT_MAGIC {
        return Err(ContractError::InvalidMagic);
    }

    // Parse signature (64 bytes at offset 4)
    let mut sig_bytes = [0u8; 64];
    for i in 0..64 {
        sig_bytes[i] = get_byte(data, 4 + i as u32)?;
    }
    let signature = BytesN::from_array(env, &sig_bytes);

    // Parse recovery_id (1 byte at offset 68)
    let recovery_id = get_byte(data, 68)? as u32;

    // Parse payload_length (LE u16 at offset 69)
    let payload_len = read_le_u16(data, 69)? as u32;

    // Validate payload length
    let payload_start = 71u32;
    let expected_end = payload_start + payload_len;
    if expected_end != len {
        return Err(ContractError::InvalidPayloadLength);
    }

    // Extract payload
    let payload = data.slice(payload_start..expected_end);

    // Compute keccak256 hash of payload
    let hash = env.crypto().keccak256(&payload);

    // Recover public key from signature
    let uncompressed_pubkey = env.crypto().secp256k1_recover(&hash, &signature, recovery_id);

    // Compress the recovered public key
    let compressed_pubkey = compress_pubkey(env, &uncompressed_pubkey)?;

    // Look up signer in trusted signers
    let expires_at = state::get_trusted_signer_expiry(env, &compressed_pubkey)
        .ok_or(ContractError::SignerNotTrusted)?;

    // Check signer is not expired
    let current_timestamp = env.ledger().timestamp();
    if current_timestamp >= expires_at {
        return Err(ContractError::SignerExpired);
    }

    Ok(payload)
}

/// Compress a 65-byte uncompressed SEC-1 public key to 33-byte compressed format.
///
/// Input: 0x04 || x (32 bytes) || y (32 bytes)
/// Output: parity_byte || x (32 bytes)
///   where parity_byte = 0x02 if y is even, 0x03 if y is odd
fn compress_pubkey(env: &Env, uncompressed: &BytesN<65>) -> Result<BytesN<33>, ContractError> {
    let mut compressed = [0u8; 33];

    // Parity prefix: check last byte of y-coordinate for odd/even
    let y_last_byte = get_byte_n(uncompressed, 64)?;
    compressed[0] = if y_last_byte & 1 == 0 { 0x02 } else { 0x03 };

    // Copy x-coordinate (bytes 1..33 of uncompressed key)
    for i in 0..32 {
        compressed[i + 1] = get_byte_n(uncompressed, 1 + i as u32)?;
    }

    Ok(BytesN::from_array(env, &compressed))
}

/// Read a little-endian u32 from Bytes at the given offset.
fn read_le_u32(data: &Bytes, offset: u32) -> Result<u32, ContractError> {
    Ok((get_byte(data, offset)? as u32)
        | ((get_byte(data, offset + 1)? as u32) << 8)
        | ((get_byte(data, offset + 2)? as u32) << 16)
        | ((get_byte(data, offset + 3)? as u32) << 24))
}

/// Read a little-endian u16 from Bytes at the given offset.
fn read_le_u16(data: &Bytes, offset: u32) -> Result<u16, ContractError> {
    Ok((get_byte(data, offset)? as u16) | ((get_byte(data, offset + 1)? as u16) << 8))
}
