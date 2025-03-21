module pyth::setup {
    use sui::object::{Self, UID};
    use sui::package::{Self, UpgradeCap};
    use sui::transfer::{Self};
    use sui::tx_context::{Self, TxContext};

    use pyth::state::{Self};
    use pyth::data_source::{DataSource};

    friend pyth::pyth;
    #[test_only]
    friend pyth::pyth_tests;

    /// Capability created at `init`, which will be destroyed once
    /// `init_and_share_state` is called. This ensures only the deployer can
    /// create the shared `State`.
    struct DeployerCap has key, store {
        id: UID
    }

    fun init(ctx: &mut TxContext) {
        transfer::public_transfer(
            DeployerCap {
                id: object::new(ctx)
            },
            tx_context::sender(ctx)
        );
    }

    #[test_only]
    public fun init_test_only(ctx: &mut TxContext) {
        init(ctx);

        // This will be created and sent to the transaction sender
        // automatically when the contract is published.
        transfer::public_transfer(
            sui::package::test_publish(object::id_from_address(@pyth), ctx),
            tx_context::sender(ctx)
        );
    }

    #[allow(lint(share_owned))]
    /// Only the owner of the `DeployerCap` can call this method. This
    /// method destroys the capability and shares the `State` object.
    public(friend) fun init_and_share_state(
        deployer: DeployerCap,
        upgrade_cap: UpgradeCap,
        stale_price_threshold: u64,
        base_update_fee: u64,
        governance_data_source: DataSource,
        sources: vector<DataSource>,
        ctx: &mut TxContext
    ) {
        wormhole::package_utils::assert_package_upgrade_cap<DeployerCap>(
            &upgrade_cap,
            package::compatible_policy(),
            1
        );

        // Destroy deployer cap.
        let DeployerCap { id } = deployer;
        object::delete(id);

        // Share new state.
        transfer::public_share_object(
            state::new(
                upgrade_cap,
                sources,
                governance_data_source,
                stale_price_threshold,
                base_update_fee,
                ctx
            ));
    }
}
