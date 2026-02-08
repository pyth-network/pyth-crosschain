module pyth_lazer::state;

#[test_only]
use std::unit_test::{assert_eq, destroy};
use std::type_name;
#[test_only]
use sui::package;
use sui::package::{UpgradeCap, UpgradeReceipt, UpgradeTicket};

use wormhole::vaa::VAA;

use pyth_lazer::{
    governance::{Self, Governance, GovernanceHeader},
    meta,
    parser::{Self, Parser},
};

#[error]
const EInvalidPubkeyLen: vector<u8> = "Invalid public key length, must be 33";
#[error]
const ERemovedSignerNotFound: vector<u8> = "Could not remove non-existent trusted signer";
#[error]
const EDifferentVersion: vector<u8> = "State can only be used with the current package version";
#[error]
const EDifferentUpgradeCap: vector<u8> = "Supplied UpgradeCap belongs to a different package";

// Constant as a function to allow exporting
public(package) fun secp256k1_compressed_pubkey_len(): u64 {
    33
}

/// Lazer State consists of the current set of trusted signers.
/// By verifying that a price update was signed by one of these public keys,
/// you can validate the authenticity of a Lazer price update.
///
/// The trusted signers are subject to rotations and expiry.
///
/// Always use the latest version of the Sui Lazer contract, as older versions
/// will fail when accessing the state. Official SDK fetches the current
/// version automatically.
public struct State has key {
    id: UID,
    trusted_signers: vector<TrustedSignerInfo>,
    upgrade_cap: UpgradeCap,
    governance: Governance,
}

/// Construct and share a unique Lazer State, taking ownership of the supplied
/// UpgradeCap.
public(package) fun share(
    upgrade_cap: UpgradeCap,
    governance: Governance,
    ctx: &mut TxContext
) {
    assert!(
        upgrade_cap.package().to_address() == type_name::original_id<State>(),
        EDifferentUpgradeCap,
    );
    assert!(meta::version() == upgrade_cap.version(), EDifferentVersion);
    transfer::share_object(State {
        id: object::new(ctx),
        trusted_signers: vector[],
        upgrade_cap,
        governance,
    })
}

/// Unpack Pyth Governance message wrapped in VAA, while checking its validity.
public(package) fun unwrap_ptgm(
    self: &mut State,
    _: &CurrentCap,
    vaa: VAA
): (GovernanceHeader, Parser) {
    let payload = self.governance.process_incoming(vaa);
    let mut parser = parser::new(payload);
    let header = governance::parse_header(&mut parser);
    (header, parser)
}

public(package) fun authorize_upgrade(
    self: &mut State,
    _: &CurrentCap,
    digest: vector<u8>,
): UpgradeTicket {
    let policy = self.upgrade_cap.policy();
    self.upgrade_cap.authorize(policy, digest)
}

public(package) fun commit_upgrade(
    self: &mut State,
    _: &CurrentCap,
    receipt: UpgradeReceipt,
) {
    self.upgrade_cap.commit(receipt)
}

public(package) fun trusted_signers(
    self: &State,
    _: &CurrentCap
): &vector<TrustedSignerInfo> {
    &self.trusted_signers
}

/// Upsert a trusted signer's information or remove them.
/// - If the trusted signer pubkey already exists, the expires_at will be updated.
///   - If the expired_at is set to zero, the trusted signer will be removed.
/// - If the pubkey isn't found, it is added as a new trusted signer with the given expires_at.
public(package) fun update_trusted_signer(
    self: &mut State,
    _: &CurrentCap,
    pubkey: vector<u8>,
    expires_at: u64
) {
    assert!(
        pubkey.length() == secp256k1_compressed_pubkey_len(),
        EInvalidPubkeyLen
    );

    let mut maybe_idx = self.trusted_signers.find_index!(|signer|
        signer.public_key() == &pubkey
    );
    if (expires_at == 0) {
        if (maybe_idx.is_some()) {
            let idx = maybe_idx.extract();
            // Remove by swapping with last (order not preserved), discard
            // removed value
            self.trusted_signers.swap_remove(idx);
        } else {
            maybe_idx.destroy_none();
            abort ERemovedSignerNotFound
        };
        return
    };

    if (maybe_idx.is_some()) {
        let idx = maybe_idx.extract();
        let info_ref = &mut self.trusted_signers[idx];
        info_ref.expires_at = expires_at
    } else {
        maybe_idx.destroy_none();
        self.trusted_signers.push_back(
            TrustedSignerInfo { public_key: pubkey, expires_at }
        );
    }
}

/// Capability asserting that an owner has checked the current package version
/// against the used one.
public struct CurrentCap has drop {}

public(package) fun current_cap(self: &State): CurrentCap {
    assert!(meta::version() == self.upgrade_cap.version(), EDifferentVersion);
    CurrentCap {}
}

/// A trusted signer is comprised of a pubkey and an expiry timestamp (seconds
/// since Unix epoch). A signer's signature should only be trusted up to
/// timestamp `expires_at`.
public struct TrustedSignerInfo has copy, drop, store {
    public_key: vector<u8>,
    expires_at: u64,
}

/// Get a reference to the trusted signer's public key.
public(package) fun public_key(info: &TrustedSignerInfo): &vector<u8> {
    &info.public_key
}

/// Get the trusted signer's expiry timestamp, converted to milliseconds.
public(package) fun expires_at_ms(info: &TrustedSignerInfo): u64 {
    info.expires_at * 1000
}

#[test_only]
fun upgrade_cap_for_test(package: ID, ctx: &mut TxContext): UpgradeCap {
    let mut upgrade_cap = package::test_publish(package, ctx);
    let policy = upgrade_cap.policy();
    let digest = x"0000000000000000000000000000000000000000000000000000000000000000";
    // Run fake upgrades to increment test UpgradeCap to current package version
    (meta::version() - 1).do!(|_| {
        let ticket = upgrade_cap.authorize(policy, digest);
        upgrade_cap.commit(ticket.test_upgrade());
    });
    upgrade_cap
}

#[test_only]
public fun new_for_test(ctx: &mut TxContext, governance: Governance): State {
    State {
        id: object::new(ctx),
        trusted_signers: vector::empty<TrustedSignerInfo>(),
        upgrade_cap: upgrade_cap_for_test(
            @0x7e57.to_id(),
            ctx
        ),
        governance,
    }
}

#[test]
public fun test_add_new_signer() {
    let mut ctx = tx_context::dummy();
    let mut state = new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();

    let pk = x"030102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
    let expiry = 123u64;
    state.update_trusted_signer(&current_cap, pk, expiry);

    let signers = state.trusted_signers(&current_cap);
    assert_eq!(signers.length(), 1);
    let signer = &signers[0];
    assert_eq!(signer.expires_at, expiry);
    assert_eq!(signer.public_key, pk);

    destroy(state);
}

#[test]
public fun test_update_existing_signer_expiry() {
    let mut ctx = tx_context::dummy();
    let mut state = new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();

    state.update_trusted_signer(
        &current_cap,
        x"032a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a",
        1000,
    );
    state.update_trusted_signer(
        &current_cap,
        x"032a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a",
        2000,
    );

    let signers = state.trusted_signers(&current_cap);
    assert_eq!(signers.length(), 1);
    assert_eq!(signers[0].expires_at, 2000);

    destroy(state);
}

#[test]
public fun test_remove_signer_by_zero_expiry() {
    let mut ctx = tx_context::dummy();
    let mut state = new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();

    state.update_trusted_signer(
        &current_cap,
        x"030707070707070707070707070707070707070707070707070707070707070707",
        999,
    );
    state.update_trusted_signer(
        &current_cap,
        x"030707070707070707070707070707070707070707070707070707070707070707",
        0,
    );

    assert_eq!(state.trusted_signers(&current_cap).length(), 0);

    destroy(state);
}

#[test, expected_failure(abort_code = EInvalidPubkeyLen)]
public fun test_invalid_pubkey_length_rejected() {
    let mut ctx = tx_context::dummy();
    let mut state = new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();

    state.update_trusted_signer(&current_cap, x"010203", 1);

    destroy(state);
}

#[test, expected_failure(abort_code = ERemovedSignerNotFound)]
public fun test_remove_nonexistent_signer_fails() {
    let mut ctx = tx_context::dummy();
    let mut state = new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();

    // Try to remove a signer that doesn't exist by setting expires_at to 0
    state.update_trusted_signer(
        &current_cap,
        x"03aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        0,
    );

    destroy(state);
}
