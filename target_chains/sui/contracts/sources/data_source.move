module pyth::data_source;

use pyth::set;
use sui::dynamic_field;
use wormhole::external_address::ExternalAddress;

const KEY: vector<u8> = b"data_sources";

const EDataSourceRegistryAlreadyExists: u64 = 0;
const EDataSourceAlreadyRegistered: u64 = 1;

public struct DataSource has copy, drop, store {
    emitter_chain: u64,
    emitter_address: ExternalAddress,
}

public(package) fun new_data_source_registry(parent_id: &mut UID, ctx: &mut TxContext) {
    assert!(
        !dynamic_field::exists_(parent_id, KEY),
        EDataSourceRegistryAlreadyExists, // TODO - add custom error type
    );
    dynamic_field::add(
        parent_id,
        KEY,
        set::new<DataSource>(ctx),
    )
}

public(package) fun add(parent_id: &mut UID, data_source: DataSource) {
    assert!(!contains(parent_id, data_source), EDataSourceAlreadyRegistered);
    set::add(
        dynamic_field::borrow_mut(parent_id, KEY),
        data_source,
    )
}

public(package) fun empty(parent_id: &mut UID) {
    set::empty<DataSource>(
        dynamic_field::borrow_mut(parent_id, KEY),
    )
}

public fun contains(parent_id: &UID, data_source: DataSource): bool {
    let ref = dynamic_field::borrow(parent_id, KEY);
    set::contains<DataSource>(ref, data_source)
}

public(package) fun new(emitter_chain: u64, emitter_address: ExternalAddress): DataSource {
    DataSource {
        emitter_chain,
        emitter_address,
    }
}

public fun emitter_chain(data_source: &DataSource): u64 {
    data_source.emitter_chain
}

public fun emitter_address(data_source: &DataSource): ExternalAddress {
    data_source.emitter_address
}

#[test_only]
public fun new_data_source_for_test(
    emitter_chain: u64,
    emitter_address: ExternalAddress,
): DataSource {
    DataSource {
        emitter_chain,
        emitter_address,
    }
}
