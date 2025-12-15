module pyth_lazer::state;

#[test_only]
use pyth_lazer::admin;
use pyth_lazer::admin::AdminCap;

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

/// Get the trusted signer's expiry timestamp, converted to milliseconds
public fun expires_at_ms(info: &TrustedSignerInfo): u64 {
    info.expires_at * 1000
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
    assert!(pubkey.length() == SECP256K1_COMPRESSED_PUBKEY_LEN, EInvalidPubkeyLen);

    let mut maybe_idx = find_signer_index(&s.trusted_signers, &pubkey);
    if (expires_at == 0) {
        if (maybe_idx.is_some()) {
            let idx = maybe_idx.extract();
            // Remove by swapping with last (order not preserved), discard removed value
            let _ = s.trusted_signers.swap_remove(idx);
        } else {
            maybe_idx.destroy_none();
            abort ESignerNotFound
        };
        return
    };

    if (maybe_idx.is_some()) {
        let idx = maybe_idx.extract();
        let info_ref = &mut s.trusted_signers[idx];
        info_ref.expires_at = expires_at
    } else {
        maybe_idx.destroy_none();
        s.trusted_signers.push_back(
            TrustedSignerInfo { public_key: pubkey, expires_at }
        );
    }
}

public fun find_signer_index(
    signers: &vector<TrustedSignerInfo>,
    public_key: &vector<u8>,
): Option<u64> {
    let len = signers.length();
    let mut i: u64 = 0;
    while (i < len) {
        let signer = &signers[i];
        if (signer.public_key() == public_key) {
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
    id.delete();
}

#[test]
public fun test_add_new_signer() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);

    let pk = x"030102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
    let expiry: u64 = 123;

    update_trusted_signer(&admin_cap, &mut s, pk, expiry);

    let signers_ref = s.get_trusted_signers();
    assert!(signers_ref.length() == 1, 100);
    let info = &signers_ref[0];
    assert!(info.expires_at == 123, 101);
    let got_pk = info.public_key();
    assert!(got_pk.length() == SECP256K1_COMPRESSED_PUBKEY_LEN, 102);

    s.destroy_for_test();
    admin_cap.destroy_for_test();
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

    let signers_ref = s.get_trusted_signers();
    assert!(signers_ref.length() == 1, 110);
    let info = &signers_ref[0];
    assert!(info.expires_at == 2000, 111);

    s.destroy_for_test();
    admin_cap.destroy_for_test();
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

    let signers_ref = s.get_trusted_signers();
    assert!(signers_ref.length() == 0, 120);

    s.destroy_for_test();
    admin_cap.destroy_for_test();
}

#[test, expected_failure(abort_code = EInvalidPubkeyLen)]
public fun test_invalid_pubkey_length_rejected() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);

    let short_pk = x"010203";
    update_trusted_signer(&admin_cap, &mut s, short_pk, 1);

    s.destroy_for_test();
    admin_cap.destroy_for_test();
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

    s.destroy_for_test();
    admin_cap.destroy_for_test();
}
