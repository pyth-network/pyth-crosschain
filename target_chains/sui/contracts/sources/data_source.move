module pyth::data_source {
    use sui::dynamic_field::{Self};
    use sui::object::{UID};
    use sui::tx_context::{TxContext};

    use pyth::set::{Self};

    use wormhole::external_address::ExternalAddress;

    const KEY: vector<u8> = b"data_sources";

    struct DataSource has copy, drop, store {
        emitter_chain: u64,
        emitter_address: ExternalAddress,
    }

    public fun new_data_source_registry(parent_id: &mut UID, ctx: &mut TxContext) {
        assert!(
            !dynamic_field::exists_(parent_id, KEY),
            0 // TODO - add custom error type
        );
        dynamic_field::add(
            parent_id,
            KEY,
            set::new<DataSource>(ctx)
        )
    }

    public fun add(parent_id: &mut UID, data_source: DataSource) {
        assert!(
            !contains(parent_id, data_source),
            0 // TODO - add custom error message
        );
        set::add(
            dynamic_field::borrow_mut(parent_id, KEY),
            data_source
        )
    }

    public fun empty(parent_id: &mut UID){
        set::empty<DataSource>(
            dynamic_field::borrow_mut(parent_id, KEY)
        )
    }

    public fun contains(parent_id: &UID, data_source: DataSource): bool {
        let ref = dynamic_field::borrow(parent_id, KEY);
        set::contains<DataSource>(ref, data_source)
    }

    public fun new(emitter_chain: u64, emitter_address: ExternalAddress): DataSource {
        DataSource {
            emitter_chain: emitter_chain,
            emitter_address: emitter_address,
        }
    }
}
