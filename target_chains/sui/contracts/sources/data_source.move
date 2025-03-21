module pyth::data_source {
    use sui::dynamic_field::{Self};
    use sui::object::{UID};
    use sui::tx_context::{TxContext};

    use pyth::set::{Self};

    use wormhole::external_address::ExternalAddress;

    friend pyth::state;
    friend pyth::set_data_sources;
    friend pyth::pyth;
    friend pyth::set_governance_data_source;
    friend pyth::governance;
    #[test_only]
    friend pyth::pyth_tests;
    #[test_only]
    friend pyth::set_data_sources_tests;

    const KEY: vector<u8> = b"data_sources";
    const E_DATA_SOURCE_REGISTRY_ALREADY_EXISTS: u64 = 0;
    const E_DATA_SOURCE_ALREADY_REGISTERED: u64 = 1;

    struct DataSource has copy, drop, store {
        emitter_chain: u64,
        emitter_address: ExternalAddress,
    }

    public(friend) fun new_data_source_registry(parent_id: &mut UID, ctx: &mut TxContext) {
        assert!(
            !dynamic_field::exists_(parent_id, KEY),
            E_DATA_SOURCE_REGISTRY_ALREADY_EXISTS // TODO - add custom error type
        );
        dynamic_field::add(
            parent_id,
            KEY,
            set::new<DataSource>(ctx)
        )
    }

    public(friend) fun add(parent_id: &mut UID, data_source: DataSource) {
        assert!(
            !contains(parent_id, data_source),
            E_DATA_SOURCE_ALREADY_REGISTERED
        );
        set::add(
            dynamic_field::borrow_mut(parent_id, KEY),
            data_source
        )
    }

    public(friend) fun empty(parent_id: &mut UID){
        set::empty<DataSource>(
            dynamic_field::borrow_mut(parent_id, KEY)
        )
    }

    public fun contains(parent_id: &UID, data_source: DataSource): bool {
        let ref = dynamic_field::borrow(parent_id, KEY);
        set::contains<DataSource>(ref, data_source)
    }

    public(friend) fun new(emitter_chain: u64, emitter_address: ExternalAddress): DataSource {
        DataSource {
            emitter_chain,
            emitter_address,
        }
    }

    public fun emitter_chain(data_source: &DataSource): u64{
        data_source.emitter_chain
    }

    public fun emitter_address(data_source: &DataSource): ExternalAddress{
        data_source.emitter_address
    }

    #[test_only]
    public fun new_data_source_for_test(emitter_chain: u64, emitter_address: ExternalAddress): DataSource {
        DataSource {
            emitter_chain,
            emitter_address,
        }
    }
}
