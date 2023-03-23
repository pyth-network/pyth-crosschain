module pyth::state {
    use std::vector;
    use sui::object::{Self, UID, ID};
    use sui::transfer::{Self};
    use sui::tx_context::{Self, TxContext};

    use pyth::data_source::{Self, DataSource};
    use pyth::price_info::{Self};
    use pyth::price_identifier::{PriceIdentifier};

    friend pyth::pyth;

    /// Capability for creating a bridge state object, granted to sender when this
    /// module is deployed
    struct DeployerCap has key, store {
        id: UID
    }

    struct State has key {
        id: UID,
        governance_data_source: DataSource,
        last_executed_governance_sequence: u64,
        stale_price_threshold: u64,
        base_update_fee: u64,
    }

    fun init(ctx: &mut TxContext) {
        transfer::transfer(
            DeployerCap {
                id: object::new(ctx)
            },
            tx_context::sender(ctx)
        );
    }

    // Initialization
    public(friend) fun init_and_share_state(
        deployer: DeployerCap,
        stale_price_threshold: u64,
        base_update_fee: u64,
        governance_data_source: DataSource,
        sources: vector<DataSource>,
        ctx: &mut TxContext
    ) {
        let DeployerCap { id } = deployer;
        object::delete(id);

        let uid = object::new(ctx);

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
                governance_data_source,
                last_executed_governance_sequence: 0,
                stale_price_threshold,
                base_update_fee,
            }
        );
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
