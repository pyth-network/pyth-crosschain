module pyth_lazer::pyth_lazer;

use sui::{
    bcs,
    clock::Clock,
    ecdsa_k1::secp256k1_ecrecover,
};

use pyth_lazer::{
    state::State,
    update::{Self, Update},
};

const SECP256K1_SIG_LEN: u32 = 65;
const UPDATE_MESSAGE_MAGIC: u32 = 1296547300;
const PAYLOAD_MAGIC: u32 = 2479346549;

#[error]
const ESignerNotTrusted: vector<u8> = "Recovered public key is not in the trusted signers list";
#[error]
const ESignerExpired: vector<u8> = "Signer's certificate has expired";
#[error]
const EInvalidUpdateMagic: vector<u8> = "Invalid magic number in update";
#[error]
const EInvalidPayloadMagic: vector<u8> = "Invalid magic number in payload";
#[error]
const EInvalidPayloadLength: vector<u8> = "Payload length doesn't match data";

/// Verify LE ECDSA message signature against trusted signers.
///
/// This function recovers the public key from the signature and payload,
/// then checks if the recovered public key is in the trusted signers list
/// and has not expired.
///
/// # Arguments
/// * `s` - The pyth_lazer::state::State
/// * `clock` - The sui::clock::Clock
/// * `signature` - The ECDSA signature bytes (little endian)
/// * `payload` - The message payload that was signed
///
/// # Errors
/// * `ESignerNotTrusted` - The recovered public key is not in the trusted signers list
/// * `ESignerExpired` - The signer's certificate has expired
public(package) fun verify_le_ecdsa_message(
    state: &State,
    clock: &Clock,
    signature: &vector<u8>,
    payload: &vector<u8>,
) {
    let current_cap = state.current_cap();

    // 0 stands for keccak256 hash
    let pubkey = secp256k1_ecrecover(signature, payload, 0);

    // Check if the recovered pubkey is in the trusted signers list
    let trusted_signers = state.trusted_signers(&current_cap);
    let mut maybe_idx = trusted_signers.find_index!(|signer|
        signer.public_key() == &pubkey
    );

    assert!(maybe_idx.is_some(), ESignerNotTrusted);
    let idx = maybe_idx.extract();
    let expires_at_ms = trusted_signers[idx].expires_at_ms();
    assert!(clock.timestamp_ms() < expires_at_ms, ESignerExpired);
}

/// Parse the Lazer update message and validate the signature within.
/// The parsing logic is based on the Lazer rust protocol definition defined here:
/// https://docs.rs/pyth-lazer-protocol/latest/pyth_lazer_protocol/payload/index.html
///
/// # Arguments
/// * `s` - The pyth_lazer::state::State
/// * `clock` - The sui::clock::Clock
/// * `update` - The LeEcdsa formatted Lazer update
///
/// # Errors
/// * `EInvalidUpdateMagic` - Invalid magic number in update
/// * `EInvalidPayloadMagic` - Invalid magic number in payload
/// * `EInvalidPayloadLength` - Payload length doesn't match actual data
/// * `ESignerNotTrusted` - The recovered public key is not in the trusted signers list
/// * `ESignerExpired` - The signer's certificate has expired
public fun parse_and_verify_le_ecdsa_update(s: &State, clock: &Clock, update: vector<u8>): Update {
    let mut cursor = bcs::new(update);

    // Parse and validate message magic
    let magic = cursor.peel_u32();
    assert!(magic == UPDATE_MESSAGE_MAGIC, EInvalidUpdateMagic);

    // Parse signature
    let mut signature = vector::empty<u8>();
    let mut sig_i = 0;
    while (sig_i < SECP256K1_SIG_LEN) {
        signature.push_back(cursor.peel_u8());
        sig_i = sig_i + 1;
    };

    // Parse expected payload length and get remaining bytes as payload
    let payload_len = cursor.peel_u16();
    let payload = cursor.into_remainder_bytes();

    // Validate expected payload length
    assert!(payload_len as u64 == payload.length(), EInvalidPayloadLength);

    // Parse payload
    let mut payload_cursor = bcs::new(payload);
    let payload_magic = payload_cursor.peel_u32();
    assert!(payload_magic == PAYLOAD_MAGIC, EInvalidPayloadMagic);

    // Verify the signature against trusted signers
    verify_le_ecdsa_message(s, clock, &signature, &payload);

    update::parse_from_cursor(payload_cursor)
}
