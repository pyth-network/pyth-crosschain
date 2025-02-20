module pyth::state {
    use std::vector;
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::package::{UpgradeCap, UpgradeTicket, UpgradeReceipt};

    use pyth::data_source::{Self, DataSource};
    use pyth::price_info::{Self};
    use pyth::price_identifier::{Self, PriceIdentifier};
    use pyth::version_control::{Self};

    use wormhole::consumed_vaas::{Self, ConsumedVAAs};
    use wormhole::bytes32::{Self, Bytes32};
    use wormhole::package_utils::{Self};
    use wormhole::external_address::{ExternalAddress};

    friend pyth::pyth;
    #[test_only]
    friend pyth::pyth_tests;
    friend pyth::governance_action;
    friend pyth::set_update_fee;
    friend pyth::set_stale_price_threshold;
    friend pyth::set_data_sources;
    friend pyth::governance;
    friend pyth::set_governance_data_source;
    friend pyth::migrate;
    friend pyth::contract_upgrade;
    friend pyth::set_fee_recipient;
    friend pyth::setup;

    /// Build digest does not agree with current implementation.
    const E_INVALID_BUILD_DIGEST: u64 = 0;

    /// Capability reflecting that the current build version is used to invoke
    /// state methods.
    struct LatestOnly has drop {}

    #[test_only]
    public fun create_latest_only_for_test():LatestOnly {
        LatestOnly{}
    }

    struct State has key, store {
        id: UID,
        governance_data_source: DataSource,
        stale_price_threshold: u64,
        base_update_fee: u64,
        fee_recipient_address: address,
        last_executed_governance_sequence: u64,
        consumed_vaas: ConsumedVAAs,

        // Upgrade capability.
        upgrade_cap: UpgradeCap
    }

    public(friend) fun new(
        upgrade_cap: UpgradeCap,
        sources: vector<DataSource>,
        governance_data_source: DataSource,
        stale_price_threshold: u64,
        base_update_fee: u64,
        ctx: &mut TxContext
    ): State {
        let uid = object::new(ctx);

        // Create a set that contains all registered data sources and
        // attach it to uid as a dynamic field to minimize the
        // size of State.
        data_source::new_data_source_registry(&mut uid, ctx);

        // Create a table that tracks the object IDs of price feeds and
        // attach it to the uid as a dynamic object field to minimize the
        // size of State.
        price_info::new_price_info_registry(&mut uid, ctx);

        while (!vector::is_empty(&sources)) {
            data_source::add(&mut uid, vector::pop_back(&mut sources));
        };

        let consumed_vaas = consumed_vaas::new(ctx);

        // Initialize package info. This will be used for emitting information
        // of successful migrations.
        package_utils::init_package_info(
            &mut uid,
            version_control::current_version(),
            &upgrade_cap
        );

        State {
            id: uid,
            upgrade_cap,
            governance_data_source,
            stale_price_threshold,
            fee_recipient_address: tx_context::sender(ctx),
            base_update_fee,
            consumed_vaas,
            last_executed_governance_sequence: 0
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    //
    //  Simple Getters
    //
    //  These methods do not require `LatestOnly` for access. Anyone is free to
    //  access these values.
    //
    ////////////////////////////////////////////////////////////////////////////

    public fun get_stale_price_threshold_secs(s: &State): u64 {
        s.stale_price_threshold
    }

    public fun get_base_update_fee(s: &State): u64 {
        s.base_update_fee
    }

    public fun get_fee_recipient(s: &State): address {
        s.fee_recipient_address
    }

    public fun is_valid_data_source(s: &State, data_source: DataSource): bool {
        data_source::contains(&s.id, data_source)
    }

    public fun is_valid_governance_data_source(s: &State, source: DataSource): bool {
        s.governance_data_source == source
    }

    public fun price_feed_object_exists(s: &State, p: PriceIdentifier): bool {
        price_info::contains(&s.id, p)
    }

    /// Retrieve governance chain ID, which is governance's emitter chain ID.
    public fun governance_data_source(self: &State): DataSource {
        self.governance_data_source
    }

    public fun get_last_executed_governance_sequence(self: &State): u64{
        return self.last_executed_governance_sequence
    }

    /// Retrieve governance module name.
    public fun governance_module(): Bytes32 {
        bytes32::new(
            x"0000000000000000000000000000000000000000000000000000000000000001"
        )
    }

    /// Retrieve governance chain ID, which is governance's emitter chain ID.
    public fun governance_chain(self: &State): u16 {
        let governance_data_source = governance_data_source(self);
        (data_source::emitter_chain(&governance_data_source) as u16)
    }

    /// Retrieve governance emitter address.
    public fun governance_contract(self: &State): ExternalAddress {
                let governance_data_source = governance_data_source(self);
        data_source::emitter_address(&governance_data_source)
    }

    public fun get_price_info_object_id(self: &State, price_identifier_bytes: vector<u8>): ID {
        let price_identifier = price_identifier::from_byte_vec(price_identifier_bytes);
        price_info::get_id(&self.id, price_identifier)
    }

    ////////////////////////////////////////////////////////////////////////////
    //
    //  Privileged `State` Access
    //
    //  This section of methods require a `LatestOnly`, which can only be created
    //  within the Wormhole package. This capability allows special access to
    //  the `State` object.
    //
    //  NOTE: A lot of these methods are still marked as `(friend)` as a safety
    //  precaution. When a package is upgraded, friend modifiers can be
    //  removed.
    //
    ////////////////////////////////////////////////////////////////////////////

    /// Obtain a capability to interact with `State` methods. This method checks
    /// that we are running the current build.
    ///
    /// NOTE: This method allows caching the current version check so we avoid
    /// multiple checks to dynamic fields.
    public(friend) fun assert_latest_only(self: &State): LatestOnly {
        package_utils::assert_version(
            &self.id,
            version_control::current_version()
        );

        LatestOnly {}
    }

    public(friend) fun set_fee_recipient(
        _: &LatestOnly,
        self: &mut State,
        addr: address
    ) {
        self.fee_recipient_address = addr;
    }

    /// Store `VAA` hash as a way to claim a VAA. This method prevents a VAA
    /// from being replayed. For Wormhole, the only VAAs that it cares about
    /// being replayed are its governance actions.
    public(friend) fun borrow_mut_consumed_vaas(
        _: &LatestOnly,
        self: &mut State
    ): &mut ConsumedVAAs {
        borrow_mut_consumed_vaas_unchecked(self)
    }

    /// Store `VAA` hash as a way to claim a VAA. This method prevents a VAA
    /// from being replayed. For Wormhole, the only VAAs that it cares about
    /// being replayed are its governance actions.
    ///
    /// NOTE: This method does not require `LatestOnly`. Only methods in the
    /// `upgrade_contract` module requires this to be unprotected to prevent
    /// a corrupted upgraded contract from bricking upgradability.
    public(friend) fun borrow_mut_consumed_vaas_unchecked(
        self: &mut State
    ): &mut ConsumedVAAs {
        &mut self.consumed_vaas
    }

    public(friend) fun current_package(_: &LatestOnly, self: &State): ID {
        package_utils::current_package(&self.id)
    }

    public(friend) fun set_data_sources(_: &LatestOnly, s: &mut State, new_sources: vector<DataSource>) {
        // Empty the existing table of data sources registered in state.
        data_source::empty(&mut s.id);
        // Add the new data sources to the dynamic field registry.
        while (!vector::is_empty(&new_sources)) {
            data_source::add(&mut s.id, vector::pop_back(&mut new_sources));
        };
    }

    public(friend) fun register_price_info_object(_: &LatestOnly, s: &mut State, price_identifier: PriceIdentifier, id: ID) {
        price_info::add(&mut s.id, price_identifier, id);
    }

    public(friend) fun set_governance_data_source(_: &LatestOnly, s: &mut State, source: DataSource) {
        s.governance_data_source = source;
    }

    public(friend) fun set_last_executed_governance_sequence(_: &LatestOnly, s: &mut State, sequence: u64) {
        s.last_executed_governance_sequence = sequence;
    }

    // We have an unchecked version of set_last_executed_governance_sequence, because in the governance contract
    // upgrade code path, no LatestOnly is created (for example, see authorize_upgrade and commit_upgrade in
    // governance/contract_upgrade.move)
    public(friend) fun set_last_executed_governance_sequence_unchecked(s: &mut State, sequence: u64) {
        s.last_executed_governance_sequence = sequence;
    }

    public(friend) fun set_base_update_fee(_: &LatestOnly, s: &mut State, fee: u64) {
        s.base_update_fee = fee;
    }

    public(friend) fun set_stale_price_threshold_secs(_: &LatestOnly, s: &mut State, threshold_secs: u64) {
        s.stale_price_threshold = threshold_secs;
    }

    ////////////////////////////////////////////////////////////////////////////
    //
    //  Upgradability
    //
    //  A special space that controls upgrade logic. These methods are invoked
    //  via the `upgrade_contract` module.
    //
    //  Also in this section is managing contract migrations, which uses the
    //  `migrate` module to officially roll state access to the latest build.
    //  Only those methods that require `LatestOnly` will be affected by an
    //  upgrade.
    //
    ////////////////////////////////////////////////////////////////////////////

    /// Issue an `UpgradeTicket` for the upgrade.
    ///
    /// NOTE: The Sui VM performs a check that this method is executed from the
    /// latest published package. If someone were to try to execute this using
    /// a stale build, the transaction will revert with `PackageUpgradeError`,
    /// specifically `PackageIDDoesNotMatch`.
    public(friend) fun authorize_upgrade(
        self: &mut State,
        package_digest: Bytes32
    ): UpgradeTicket {
        let cap = &mut self.upgrade_cap;
        package_utils::authorize_upgrade(&mut self.id, cap, package_digest)
    }

    /// Finalize the upgrade that ran to produce the given `receipt`.
    ///
    /// NOTE: The Sui VM performs a check that this method is executed from the
    /// latest published package. If someone were to try to execute this using
    /// a stale build, the transaction will revert with `PackageUpgradeError`,
    /// specifically `PackageIDDoesNotMatch`.
    public(friend) fun commit_upgrade(
        self: &mut State,
        receipt: UpgradeReceipt
    ): (ID, ID) {
        let cap = &mut self.upgrade_cap;
        package_utils::commit_upgrade(&mut self.id, cap, receipt)
    }

    /// Method executed by the `migrate` module to roll access from one package
    /// to another. This method will be called from the upgraded package.
    public(friend) fun migrate_version(self: &mut State) {
        package_utils::migrate_version(
            &mut self.id,
            version_control::previous_version(),
            version_control::current_version()
        );
    }

    /// As a part of the migration, we verify that the upgrade contract VAA's
    /// encoded package digest used in `migrate` equals the one used to conduct
    /// the upgrade.
    public(friend) fun assert_authorized_digest(
        _: &LatestOnly,
        self: &State,
        digest: Bytes32
    ) {
        let authorized = package_utils::authorized_digest(&self.id);
        assert!(digest == authorized, E_INVALID_BUILD_DIGEST);
    }

    ////////////////////////////////////////////////////////////////////////////
    //
    //  Special State Interaction via Migrate
    //
    //  A VERY special space that manipulates `State` via calling `migrate`.
    //
    //  PLEASE KEEP ANY METHODS HERE AS FRIENDS. We want the ability to remove
    //  these for future builds.
    //
    ////////////////////////////////////////////////////////////////////////////

    public(friend) fun migrate__v__0_1_1(self: &mut State) {
        // We need to add dynamic fields via the new package utils method. These
        // fields do not exist in the previous build (0.1.0).
        // See `state::new` above.

        // Initialize package info. This will be used for emitting information
        // of successful migrations.
        let upgrade_cap = &self.upgrade_cap;
        package_utils::init_package_info(
            &mut self.id,
            version_control::current_version(),
            upgrade_cap,
        );
    }

    #[test_only]
    /// Bloody hack.
    public fun reverse_migrate__v__0_1_0(self: &mut State) {
        package_utils::remove_package_info(&mut self.id);

        // Add back in old dynamic field(s)...

        // Add dummy hash since this is the first time the package is published.
        sui::dynamic_field::add(&mut self.id, CurrentDigest {}, bytes32::from_bytes(b"new build"));
    }

    #[test_only]
    public fun register_price_info_object_for_test(self: &mut State, price_identifier: PriceIdentifier, id: ID) {
        price_info::add(&mut self.id, price_identifier, id);
    }

    #[test_only]
    public fun new_state_for_test(
        upgrade_cap: UpgradeCap,
        governance_data_source: DataSource,
        stale_price_threshold: u64,
        base_update_fee: u64,
        ctx: &mut TxContext
    ): State {
        State {
            id: object::new(ctx),
            upgrade_cap,
            governance_data_source,
            stale_price_threshold,
            base_update_fee,
            fee_recipient_address: tx_context::sender(ctx),
            last_executed_governance_sequence: 0,
            consumed_vaas: consumed_vaas::new(ctx),
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    //
    //  Deprecated
    //
    //  Dumping grounds for old structs and methods. These things should not
    //  be used in future builds.
    //
    ////////////////////////////////////////////////////////////////////////////

    struct CurrentDigest has store, drop, copy {}

}
