module pyth::state {
    use std::vector;
    use sui::object::{Self, UID, ID};
    use sui::transfer::{Self};
    use sui::tx_context::{Self, TxContext};
    use sui::dynamic_field::{Self as field};
    use sui::package::{Self, UpgradeCap, UpgradeReceipt, UpgradeTicket};

    use pyth::data_source::{Self, DataSource};
    use pyth::price_info::{Self};
    use pyth::price_identifier::{PriceIdentifier};
    use pyth::required_version::{Self, RequiredVersion};
    use wormhole::version_control::{Self as control};

    use wormhole::setup::{assert_package_upgrade_cap};
    use wormhole::consumed_vaas::{Self};
    use wormhole::bytes32::{Self, Bytes32};

    friend pyth::pyth;
    friend pyth::pyth_tests;
    friend pyth::governance_action;
    friend pyth::set_update_fee;
    friend pyth::set_stale_price_threshold;
    friend pyth::set_data_sources;
    friend pyth::governance;
    friend pyth::set_governance_data_source;
    friend pyth::migrate;

    const E_BUILD_VERSION_MISMATCH: u64 = 0;
    const E_INVALID_BUILD_VERSION: u64 = 1;
    const E_VAA_ALREADY_CONSUMED: u64 = 2;

    /// Capability for creating a bridge state object, granted to sender when this
    /// module is deployed
    struct DeployerCap has key, store {
        id: UID
    }

    /// Used as key for dynamic field reflecting whether `migrate` can be
    /// called.
    ///
    /// See `migrate` module for more info.
    struct MigrationControl has store, drop, copy {}

    /// Used as key for dynamic field for consumed VAAs
    struct ConsumedVAAsKey has store, drop, copy {}

    struct State has key {
        id: UID,
        governance_data_source: DataSource,
        last_executed_governance_sequence: u64,
        stale_price_threshold: u64,
        base_update_fee: u64,

        // Upgrade capability.
        upgrade_cap: UpgradeCap,

        /// Contract build version tracker.
        required_version: RequiredVersion
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

    /// Initialization
    public(friend) fun init_and_share_state(
        deployer: DeployerCap,
        upgrade_cap: UpgradeCap,
        stale_price_threshold: u64,
        base_update_fee: u64,
        governance_data_source: DataSource,
        sources: vector<DataSource>,
        ctx: &mut TxContext
    ) {
        // Only init and share state once (in the initial deployment).
        let version = wormhole::version_control::version();
        assert!(version == 1, E_INVALID_BUILD_VERSION);

        let DeployerCap { id } = deployer;
        object::delete(id);

        assert_package_upgrade_cap<DeployerCap>(
            &upgrade_cap,
            package::compatible_policy(),
            1 // version
        );

        let uid = object::new(ctx);

        field::add(&mut uid, MigrationControl {}, false);
        field::add(&mut uid, ConsumedVAAsKey {}, consumed_vaas::new(ctx));

        // Create a set that contains all registered data sources and
        // attach it to uid as a dynamic field to minimize the
        // size of State.
        data_source::new_data_source_registry(&mut uid, ctx);

        // Create a table that tracks the object IDs of price feeds and
        // attach it to the uid as a dynamic object field to minimize the
        // size of State.
        price_info::new_price_info_registry(&mut uid, ctx);

        // Iterate through data sources and add them to the data source
        // registry in state.
        while (!vector::is_empty(&sources)) {
            data_source::add(&mut uid, vector::pop_back(&mut sources));
        };

        // Share state so that is a shared Sui object.
        transfer::share_object(
            State {
                id: uid,
                upgrade_cap,
                governance_data_source,
                last_executed_governance_sequence: 0,
                stale_price_threshold,
                base_update_fee,
                required_version: required_version::new(control::version(), ctx)
            }
        );
    }

    /// Retrieve current build version of latest upgrade.
    public fun current_version(self: &State): u64 {
        required_version::current(&self.required_version)
    }

    /// Issue an `UpgradeTicket` for the upgrade.
    public(friend) fun authorize_upgrade(
        self: &mut State,
        implementation_digest: Bytes32
    ): UpgradeTicket {
        let policy = package::upgrade_policy(&self.upgrade_cap);

        // TODO: grab package ID from `UpgradeCap` and store it
        // in a dynamic field. This will be the old ID after the upgrade.
        // Both IDs will be emitted in a `ContractUpgraded` event.
        package::authorize_upgrade(
            &mut self.upgrade_cap,
            policy,
            bytes32::to_bytes(implementation_digest),
        )
    }

    /// Finalize the upgrade that ran to produce the given `receipt`.
    public(friend) fun commit_upgrade(
        self: &mut State,
        receipt: UpgradeReceipt
    ): ID {
        // Uptick the upgrade cap version number using this receipt.
        package::commit_upgrade(&mut self.upgrade_cap, receipt);

        // Check that the upticked hard-coded version version agrees with the
        // upticked version number.
        assert!(
            package::version(&self.upgrade_cap) == control::version() + 1,
            E_BUILD_VERSION_MISMATCH
        );

        // Update global version.
        required_version::update_latest(
            &mut self.required_version,
            &self.upgrade_cap
        );

        // Enable `migrate` to be called after commiting the upgrade.
        //
        // A separate method is required because `state` is a dependency of
        // `migrate`. This method warehouses state modifications required
        // for the new implementation plus enabling any methods required to be
        // gated by the current implementation version. In most cases `migrate`
        // is a no-op. But it still must be called in order to reset the
        // migration control to `false`.
        //
        // See `migrate` module for more info.
        enable_migration(self);

        package::upgrade_package(&self.upgrade_cap)
    }

    /// Enforce a particular method to use the current build version as its
    /// minimum required version. This method ensures that a method is not
    /// backwards compatible with older builds.
    public(friend) fun require_current_version<ControlType>(self: &mut State) {
        required_version::require_current_version<ControlType>(
            &mut self.required_version,
        )
    }

    /// Check whether a particular method meets the minimum build version for
    /// the latest Wormhole implementation.
    public(friend) fun check_minimum_requirement<ControlType>(self: &State) {
        required_version::check_minimum_requirement<ControlType>(
            &self.required_version,
            control::version()
        )
    }

    // Upgrade and migration-related functionality

    /// Check whether `migrate` can be called.
    ///
    /// See `wormhole::migrate` module for more info.
    public fun can_migrate(self: &State): bool {
        *field::borrow(&self.id, MigrationControl {})
    }

    /// Allow `migrate` to be called after upgrade.
    ///
    /// See `wormhole::migrate` module for more info.
    public(friend) fun enable_migration(self: &mut State) {
        *field::borrow_mut(&mut self.id, MigrationControl {}) = true;
    }

    /// Disallow `migrate` to be called.
    ///
    /// See `wormhole::migrate` module for more info.
    public(friend) fun disable_migration(self: &mut State) {
        *field::borrow_mut(&mut self.id, MigrationControl {}) = false;
    }


    // Accessors
    public fun get_stale_price_threshold_secs(s: &State): u64 {
        s.stale_price_threshold
    }

    public fun get_base_update_fee(s: &State): u64 {
        s.base_update_fee
    }

    public fun is_valid_data_source(s: &State, data_source: DataSource): bool {
        data_source::contains(&s.id, data_source)
    }

    public fun is_valid_governance_data_source(s: &State, source: DataSource): bool {
        s.governance_data_source == source
    }

    public fun get_last_executed_governance_sequence(s: &State): u64 {
        s.last_executed_governance_sequence
    }

    public fun price_feed_object_exists(s: &State, p: PriceIdentifier): bool {
        price_info::contains(&s.id, p)
    }

    // Setters
    public(friend) fun set_data_sources(s: &mut State, new_sources: vector<DataSource>) {
        // Empty the existing table of data sources registered in state.
        data_source::empty(&mut s.id);
        // Add the new data sources to the dynamic field registry.
        while (!vector::is_empty(&new_sources)) {
            data_source::add(&mut s.id, vector::pop_back(&mut new_sources));
        };
    }

    public(friend) fun register_price_info_object(s: &mut State, price_identifier: PriceIdentifier, id: ID) {
        price_info::add(&mut s.id, price_identifier, id);
    }

    public(friend) fun set_last_executed_governance_sequence(s: &mut State, sequence: u64) {
        s.last_executed_governance_sequence = sequence;
    }

    public(friend) fun set_governance_data_source(s: &mut State, source: DataSource) {
        s. governance_data_source = source;
    }

    public(friend) fun set_base_update_fee(s: &mut State, fee: u64) {
        s.base_update_fee = fee;
    }

    public(friend) fun set_stale_price_threshold_secs(s: &mut State, threshold_secs: u64) {
        s.stale_price_threshold = threshold_secs;
    }

    public(friend) fun register_price_feed(s: &mut State, p: PriceIdentifier, id: ID){
        price_info::add(&mut s.id, p, id);
    }
}
