module pyth_lazer::state;

use pyth_lazer::admin::{Self, AdminCap};

const SECP256K1_COMPRESSED_PUBKEY_LEN: u64 = 33;
const EInvalidPubkeyLen: u64 = 1;
const ESignerNotFound: u64 = 2;

/// Lazer State consists of the current set of trusted signers.
/// By verifying that a price update was signed by one of these public keys,
/// you can validate the authenticity of a Lazer price update.
///
/// The trusted signers are subject to rotations and expiry.
public struct State has key, store {
    id: UID,
    trusted_signers: vector<TrustedSignerInfo>,
}

/// A trusted signer is comprised of a pubkey and an expiry timestamp (seconds since Unix epoch).
/// A signer's signature should only be trusted up to timestamp `expires_at`.
public struct TrustedSignerInfo has copy, drop, store {
    public_key: vector<u8>,
    expires_at: u64,
}

public(package) fun new(ctx: &mut TxContext): State {
    State {
        id: object::new(ctx),
        trusted_signers: vector::empty<TrustedSignerInfo>(),
    }
}

/// Get the trusted signer's public key
public fun public_key(info: &TrustedSignerInfo): &vector<u8> {
    &info.public_key
}

/// Get the trusted signer's expiry timestamp (seconds since Unix epoch)
public fun expires_at(info: &TrustedSignerInfo): u64 {
    info.expires_at
}

/// Get the list of trusted signers
public fun get_trusted_signers(s: &State): &vector<TrustedSignerInfo> {
    &s.trusted_signers
}

/// Upsert a trusted signer's information or remove them. Can only be called by the AdminCap holder.
/// - If the trusted signer pubkey already exists, the expires_at will be updated.
///   - If the expired_at is set to zero, the trusted signer will be removed.
/// - If the pubkey isn't found, it is added as a new trusted signer with the given expires_at.
public fun update_trusted_signer(_: &AdminCap, s: &mut State, pubkey: vector<u8>, expires_at: u64) {
    assert!(vector::length(&pubkey) as u64 == SECP256K1_COMPRESSED_PUBKEY_LEN, EInvalidPubkeyLen);

    let mut maybe_idx = find_signer_index(&s.trusted_signers, &pubkey);
    if (expires_at == 0) {
        if (option::is_some(&maybe_idx)) {
            let idx = option::extract(&mut maybe_idx);
            // Remove by swapping with last (order not preserved), discard removed value
            let _ = vector::swap_remove(&mut s.trusted_signers, idx);
        } else {
            option::destroy_none(maybe_idx);
            abort ESignerNotFound
        };
        return
    };

    if (option::is_some(&maybe_idx)) {
        let idx = option::extract(&mut maybe_idx);
        let info_ref = vector::borrow_mut(&mut s.trusted_signers, idx);
        info_ref.expires_at = expires_at
    } else {
        option::destroy_none(maybe_idx);
        vector::push_back(
            &mut s.trusted_signers,
            TrustedSignerInfo { public_key: pubkey, expires_at },
        )
    }
}

public fun find_signer_index(
    signers: &vector<TrustedSignerInfo>,
    public_key: &vector<u8>,
): Option<u64> {
    let len = vector::length(signers);
    let mut i: u64 = 0;
    while (i < (len as u64)) {
        let info_ref = vector::borrow(signers, i);
        if (*public_key(info_ref) == *public_key) {
            return option::some(i)
        };
        i = i + 1
    };
    option::none()
}

#[test_only]
public fun new_for_test(ctx: &mut TxContext): State {
    State {
        id: object::new(ctx),
        trusted_signers: vector::empty<TrustedSignerInfo>(),
    }
}

#[test_only]
public fun destroy_for_test(s: State) {
    let State { id, trusted_signers } = s;
    let _ = trusted_signers;
    object::delete(id);
}

#[test]
public fun test_add_new_signer() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);

    let pk = x"030102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
    let expiry: u64 = 123;

    update_trusted_signer(&admin_cap, &mut s, pk, expiry);

    let signers_ref = get_trusted_signers(&s);
    assert!(vector::length(signers_ref) == 1, 100);
    let info = vector::borrow(signers_ref, 0);
    assert!(expires_at(info) == 123, 101);
    let got_pk = public_key(info);
    assert!(vector::length(got_pk) == (SECP256K1_COMPRESSED_PUBKEY_LEN as u64), 102);
    let State { id, trusted_signers } = s;
    let _ = trusted_signers;
    object::delete(id);
    admin::destroy_for_test(admin_cap);
}

#[test]
public fun test_update_existing_signer_expiry() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);

    update_trusted_signer(
        &admin_cap,
        &mut s,
        x"032a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a",
        1000,
    );
    update_trusted_signer(
        &admin_cap,
        &mut s,
        x"032a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a",
        2000,
    );

    let signers_ref = get_trusted_signers(&s);
    assert!(vector::length(signers_ref) == 1, 110);
    let info = vector::borrow(signers_ref, 0);
    assert!(expires_at(info) == 2000, 111);
    let State { id, trusted_signers } = s;
    let _ = trusted_signers;
    object::delete(id);
    admin::destroy_for_test(admin_cap);
}

#[test]
public fun test_remove_signer_by_zero_expiry() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);

    update_trusted_signer(
        &admin_cap,
        &mut s,
        x"030707070707070707070707070707070707070707070707070707070707070707",
        999,
    );
    update_trusted_signer(
        &admin_cap,
        &mut s,
        x"030707070707070707070707070707070707070707070707070707070707070707",
        0,
    );

    let signers_ref = get_trusted_signers(&s);
    assert!(vector::length(signers_ref) == 0, 120);
    let State { id, trusted_signers } = s;
    let _ = trusted_signers;
    object::delete(id);
    admin::destroy_for_test(admin_cap);
}

#[test, expected_failure(abort_code = EInvalidPubkeyLen)]
public fun test_invalid_pubkey_length_rejected() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);

    let short_pk = x"010203";
    update_trusted_signer(&admin_cap, &mut s, short_pk, 1);
    let State { id, trusted_signers } = s;
    let _ = trusted_signers;
    object::delete(id);
    admin::destroy_for_test(admin_cap);
}

#[test, expected_failure(abort_code = ESignerNotFound)]
public fun test_remove_nonexistent_signer_fails() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);

    // Try to remove a signer that doesn't exist by setting expires_at to 0
    update_trusted_signer(
        &admin_cap,
        &mut s,
        x"03aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        0,
    );
    let State { id, trusted_signers } = s;
    let _ = trusted_signers;
    object::delete(id);
    admin::destroy_for_test(admin_cap);
}
