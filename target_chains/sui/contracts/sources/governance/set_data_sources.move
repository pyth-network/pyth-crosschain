module pyth::set_data_sources;

use pyth::data_source::{Self, DataSource};
use pyth::deserialize;
use pyth::state::{Self, State, LatestOnly};
use wormhole::bytes32;
use wormhole::cursor;
use wormhole::external_address;

public struct DataSources {
    sources: vector<DataSource>,
}

public(package) fun execute(latest_only: &LatestOnly, state: &mut State, payload: vector<u8>) {
    let DataSources { sources } = from_byte_vec(payload);
    state::set_data_sources(latest_only, state, sources);
}

fun from_byte_vec(bytes: vector<u8>): DataSources {
    let mut cursor = cursor::new(bytes);
    let data_sources_count = deserialize::deserialize_u8(&mut cursor);

    let mut sources = vector::empty();

    let mut i = 0;
    while (i < data_sources_count) {
        let emitter_chain_id = deserialize::deserialize_u16(&mut cursor);
        let emitter_address = external_address::new(
            bytes32::from_bytes(deserialize::deserialize_vector(&mut cursor, 32)),
        );
        vector::push_back(
            &mut sources,
            data_source::new((emitter_chain_id as u64), emitter_address),
        );

        i = i + 1;
    };

    cursor::destroy_empty(cursor);

    DataSources { sources }
}
