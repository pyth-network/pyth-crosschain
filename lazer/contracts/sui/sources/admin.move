module pyth_lazer::admin;

public struct AdminCap has key, store {
    id: UID,
}

public(package) fun mint(ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx) }
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
