module pyth_lazer::pyth_lazer;

use pyth_lazer::state::{Self, State};
use pyth_lazer::update::{Self, Update};
use sui::bcs;
use sui::clock::Clock;
use sui::ecdsa_k1::secp256k1_ecrecover;

const SECP256K1_SIG_LEN: u32 = 65;
const UPDATE_MESSAGE_MAGIC: u32 = 1296547300;
const PAYLOAD_MAGIC: u32 = 2479346549;

// Error codes
const ESignerNotTrusted: u64 = 2;
const ESignerExpired: u64 = 3;
const EInvalidMagic: u64 = 4;
const EInvalidPayloadLength: u64 = 6;

/// The `PYTH_LAZER` resource serves as the one-time witness.
/// It has the `drop` ability, allowing it to be consumed immediately after use.
/// See: https://move-book.com/programmability/one-time-witness
public struct PYTH_LAZER has drop {}

/// Initializes the module. Called at publish time.
/// Creates and shares the singular State object.
/// AdminCap is created and transferred in admin::init via a One-Time Witness.
fun init(_: PYTH_LAZER, ctx: &mut TxContext) {
    let s = state::new(ctx);
    transfer::public_share_object(s);
}

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
    s: &State,
    clock: &Clock,
    signature: &vector<u8>,
    payload: &vector<u8>,
) {
    // 0 stands for keccak256 hash
    let pubkey = secp256k1_ecrecover(signature, payload, 0);

    // Check if the recovered pubkey is in the trusted signers list
    let trusted_signers = state::get_trusted_signers(s);
    let mut maybe_idx = state::find_signer_index(trusted_signers, &pubkey);

    if (option::is_some(&maybe_idx)) {
        let idx = option::extract(&mut maybe_idx);
        let found_signer = &trusted_signers[idx];
        let expires_at = state::expires_at(found_signer);
        assert!(clock.timestamp_ms() < expires_at, ESignerExpired);
    } else {
        abort ESignerNotTrusted
    }
}

/// Parse the Lazer update message and validate the signature within.
/// The parsing logic is based on the Lazer rust protocol definition defined here:
/// https://github.com/pyth-network/pyth-crosschain/tree/main/lazer/sdk/rust/protocol
///
/// # Arguments
/// * `s` - The pyth_lazer::state::State
/// * `clock` - The sui::clock::Clock
/// * `update` - The LeEcdsa formatted Lazer update
///
/// # Errors
/// * `EInvalidMagic` - Invalid magic number in update or payload
/// * `EInvalidPayloadLength` - Payload length doesn't match actual data
/// * `ESignerNotTrusted` - The recovered public key is not in the trusted signers list
/// * `ESignerExpired` - The signer's certificate has expired
public fun parse_and_verify_le_ecdsa_update(s: &State, clock: &Clock, update: vector<u8>): Update {
    let mut cursor = bcs::new(update);

    // Parse and validate message magic
    let magic = cursor.peel_u32();
    assert!(magic == UPDATE_MESSAGE_MAGIC, EInvalidMagic);

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

    // Validate expectedpayload length
    assert!((payload_len as u64) == payload.length(), EInvalidPayloadLength);

    // Parse payload
    let mut payload_cursor = bcs::new(payload);
    let payload_magic = payload_cursor.peel_u32();
    assert!(payload_magic == PAYLOAD_MAGIC, EInvalidMagic);

    // Verify the signature against trusted signers
    verify_le_ecdsa_message(s, clock, &signature, &payload);

    update::parse_from_cursor(payload_cursor)
}
