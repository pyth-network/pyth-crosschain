module pyth_lazer::state;



const ED25519_PUBKEY_LEN: u64 = 32;
const E_INVALID_PUBKEY_LEN: u64 = 1;

public struct TrustedSignerInfo has copy, drop, store {
    public_key: vector<u8>,
    expires_at: u64,
}

public struct State has key, store {
    id: UID,
    trusted_signers: vector<TrustedSignerInfo>,
}

public(package) fun new(ctx: &mut TxContext): State {
    State {
        id: object::new(ctx),
        trusted_signers: vector::empty<TrustedSignerInfo>(),
    }
}

public fun public_key(info: &TrustedSignerInfo): &vector<u8> {
    &info.public_key
}

public fun expires_at(info: &TrustedSignerInfo): u64 {
    info.expires_at
}

public fun get_trusted_signers(s: &State): &vector<TrustedSignerInfo> {
    &s.trusted_signers
}

public(package) fun update_trusted_signer(s: &mut State, pubkey: vector<u8>, expires_at: u64) {
    assert!(vector::length(&pubkey) as u64 == ED25519_PUBKEY_LEN, E_INVALID_PUBKEY_LEN);

    let mut maybe_idx = find_signer_index(&s.trusted_signers, &pubkey);
    if (expires_at == 0) {
        if (option::is_some(&maybe_idx)) {
            let idx = option::extract(&mut maybe_idx);
            // Remove by swapping with last (order not preserved), discard removed value
            let _ = vector::swap_remove(&mut s.trusted_signers, idx);
        } else {
            option::destroy_none(maybe_idx)
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
            TrustedSignerInfo { public_key: pubkey, expires_at }
        )
    }
}

fun find_signer_index(signers: &vector<TrustedSignerInfo>, target: &vector<u8>): Option<u64> {
    let len = vector::length(signers);
    let mut i: u64 = 0;
    while (i < (len as u64)) {
        let info_ref = vector::borrow(signers, i);
        if (*public_key(info_ref) == *target) {
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

#[test]
public fun test_add_new_signer() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);

    let pk = x"0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
    let expiry: u64 = 123;

    update_trusted_signer(&mut s, pk, expiry);

    let signers_ref = get_trusted_signers(&s);
    assert!(vector::length(signers_ref) == 1, 100);
    let info = vector::borrow(signers_ref, 0);
    assert!(expires_at(info) == 123, 101);
    let got_pk = public_key(info);
    assert!(vector::length(got_pk) == (ED25519_PUBKEY_LEN as u64), 102);
    let State { id, trusted_signers } = s;
    let _ = trusted_signers;
    object::delete(id);
}

#[test]
public fun test_update_existing_signer_expiry() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);


    update_trusted_signer(&mut s, x"2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a", 1000);
    update_trusted_signer(&mut s, x"2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a", 2000);

    let signers_ref = get_trusted_signers(&s);
    assert!(vector::length(signers_ref) == 1, 110);
    let info = vector::borrow(signers_ref, 0);
    assert!(expires_at(info) == 2000, 111);
    let State { id, trusted_signers } = s;
    let _ = trusted_signers;
    object::delete(id);
}

#[test]
public fun test_remove_signer_by_zero_expiry() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);


    update_trusted_signer(&mut s, x"0707070707070707070707070707070707070707070707070707070707070707", 999);
    update_trusted_signer(&mut s, x"0707070707070707070707070707070707070707070707070707070707070707", 0);

    let signers_ref = get_trusted_signers(&s);
    assert!(vector::length(signers_ref) == 0, 120);
    let State { id, trusted_signers } = s;
    let _ = trusted_signers;
    object::delete(id);
}

#[test, expected_failure(abort_code = E_INVALID_PUBKEY_LEN)]
public fun test_invalid_pubkey_length_rejected() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);

    let short_pk = x"010203";
    update_trusted_signer(&mut s, short_pk, 1);
    let State { id, trusted_signers } = s;
    let _ = trusted_signers;
    object::delete(id);
}
