module pyth::state {
    use std::vector;
    use sui::object::{Self, UID};
    use sui::transfer::{Self};
    use sui::tx_context::{Self, TxContext};

    use pyth::data_source::{DataSource};
    use pyth::set::{Self, Set};

    friend pyth::pyth;

    /// Capability for creating a bridge state object, granted to sender when this
    /// module is deployed
    struct DeployerCap has key, store {
        id: UID
    }

    struct State has key {
        id: UID,
        // TODO - Make data_sources a dynamic field of State,
        // inside of something embedded in State, because there will be
        // 10k+ data sources in the future, and we want to minimize the
        // size of State.
        data_sources: Set<DataSource>,
        governance_data_source: DataSource,
        last_executed_governance_sequence: u64,
        stale_price_threshold: u64,
        base_update_fee: u64
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

        // Convert the vector of DataSource objects into a set
        // of DataSource objects
        let data_sources = set::new<DataSource>(ctx);
        while (!vector::is_empty(&sources)) {
            set::add(&mut data_sources, vector::pop_back(&mut sources));
        };
            transfer::share_object(
                State {
                    id: object::new(ctx),
                    data_sources,
                    governance_data_source,
                    last_executed_governance_sequence: 0,
                    stale_price_threshold,
                    base_update_fee
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
        set::contains<DataSource>(&s.data_sources, data_source)
    }

    public fun is_valid_governance_data_source(s: &State, source: DataSource): bool {
        s.governance_data_source == source
    }

    public fun get_last_executed_governance_sequence(s: &State): u64 {
        s.last_executed_governance_sequence
    }

    // Setters
    public(friend) fun set_data_sources(s: &mut State, new_sources: vector<DataSource>) {
        // Empty the existing set of data sources instead of dropping it,
        // because it does not have drop ability.
        set::empty<DataSource>(&mut s.data_sources);
        // Add new sources to state.data_sources.
        while (!vector::is_empty(&new_sources)) {
            set::add(&mut s.data_sources, vector::pop_back(&mut new_sources));
        };
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
}
