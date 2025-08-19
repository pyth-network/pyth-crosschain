module pyth_lazer::state;

use std::vector;
use sui::object::{Self, UID};
use sui::tx_context::{Self, TxContext};

friend pyth_lazer::pyth_lazer;

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

public(friend) fun new(ctx: &mut TxContext): State {
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

    let maybe_idx = find_signer_index(&s.trusted_signers, &pubkey);
    if (expires_at == 0) {
        if (option::is_some(&maybe_idx)) {
            let idx = option::extract(&mut maybe_idx);
            remove_by_index(&mut s.trusted_signers, idx)
        } else {
            option::destroy_none(maybe_idx)
        }
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
        let info_ref = vector::borrow(signers, (i as u64));
        if (*public_key(info_ref) == *target) {
            return option::some(i)
        };
        i = i + 1
    };
    option::none()
}

fun remove_by_index<T>(v: &mut vector<T>, idx: u64) {
    let last_idx = (vector::length(v) as u64) - 1;
    if (idx != last_idx) {
        let last = vector::pop_back(v);
        let slot_ref = vector::borrow_mut(v, idx);
        *slot_ref = last
    } else {
        vector::pop_back(v)
    }
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

    let pk = vector::from_array<u8>([
        1,2,3,4,5,6,7,8,
        9,10,11,12,13,14,15,16,
        17,18,19,20,21,22,23,24,
        25,26,27,28,29,30,31,32
    ]);
    let expiry: u64 = 123;

    update_trusted_signer(&mut s, pk, expiry);

    let signers_ref = get_trusted_signers(&s);
    assert!(vector::length(signers_ref) == 1, 100);
    let info = vector::borrow(signers_ref, 0);
    assert!(expires_at(info) == 123, 101);
    let got_pk = public_key(info);
    assert!(vector::length(got_pk) == (ED25519_PUBKEY_LEN as u64), 102);
}

#[test]
public fun test_update_existing_signer_expiry() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);

    let pk = vector::from_array<u8>([
        42,42,42,42,42,42,42,42,
        42,42,42,42,42,42,42,42,
        42,42,42,42,42,42,42,42,
        42,42,42,42,42,42,42,42
    ]);

    update_trusted_signer(&mut s, vector::copy(&pk), 1000);
    update_trusted_signer(&mut s, pk, 2000);

    let signers_ref = get_trusted_signers(&s);
    assert!(vector::length(signers_ref) == 1, 110);
    let info = vector::borrow(signers_ref, 0);
    assert!(expires_at(info) == 2000, 111);
}

#[test]
public fun test_remove_signer_by_zero_expiry() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);

    let pk = vector::from_array<u8>([
        7,7,7,7,7,7,7,7,
        7,7,7,7,7,7,7,7,
        7,7,7,7,7,7,7,7,
        7,7,7,7,7,7,7,7
    ]);

    update_trusted_signer(&mut s, vector::copy(&pk), 999);
    update_trusted_signer(&mut s, pk, 0);

    let signers_ref = get_trusted_signers(&s);
    assert!(vector::length(signers_ref) == 0, 120);
}

#[test, expected_failure(abort_code = E_INVALID_PUBKEY_LEN)]
public fun test_invalid_pubkey_length_rejected() {
    let mut ctx = tx_context::dummy();
    let mut s = new_for_test(&mut ctx);

    let short_pk = vector::from_array<u8>([1,2,3]); // too short
    update_trusted_signer(&mut s, short_pk, 1)
}
