module pyth_lazer::admin;

public struct AdminCap has key, store {
    id: UID,
}

/// The `ADMIN` resource serves as the one-time witness.
/// It has the `drop` ability, allowing it to be consumed immediately after use.
/// See: https://move-book.com/programmability/one-time-witness
public struct ADMIN has drop {}

/// Initializes the module. Called at publish time.
/// Creates and transfers ownership of the singular AdminCap capability to the deployer.
/// Only the AdminCap owner can update the trusted signers.
fun init(_: ADMIN, ctx: &mut TxContext) {
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
