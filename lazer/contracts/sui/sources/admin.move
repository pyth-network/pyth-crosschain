module pyth_lazer::admin;

public struct AdminCapability has key, store {
    id: UID,
}

public(package) fun mint(ctx: &mut TxContext): AdminCapability {
    AdminCapability { id: object::new(ctx) }
}

#[test_only]
public fun mint_for_test(ctx: &mut TxContext): AdminCapability {
    AdminCapability { id: object::new(ctx) }
}

#[test_only]
public fun destroy_for_test(cap: AdminCapability) {
    let AdminCapability { id } = cap;
    object::delete(id)
}
