module pyth_lazer::admin;

use sui::tx_context::{Self, TxContext};
use sui::object;
use sui::transfer;
use sui::types;

public struct AdminCap has key, store {
    id: UID,
}

// One-Time Witness for the admin module. Constructed by the VM once at publish time.
// Docs: https://move-book.com/programmability/one-time-witness
public struct ADMIN has drop {}

fun init(otw: ADMIN, ctx: &mut TxContext) {
    assert!(types::is_one_time_witness(&otw), 1);
    let cap = AdminCap { id: object::new(ctx) };
    transfer::public_transfer(cap, tx_context::sender(ctx));
}

#[test_only]
public fun mint_for_test(ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx) }
}

#[test_only]
public fun destroy_for_test(cap: AdminCap) {
    let AdminCap { id } = cap;
    object::delete(id)
}
