module pyth::set_data_sources {
    use std::vector;

    use wormhole::cursor;
    use wormhole::external_address::{Self};
    use wormhole::bytes32::{Self};

    use pyth::deserialize;
    use pyth::data_source::{Self, DataSource};
    use pyth::state::{Self, State};

    friend pyth::governance;

    struct SetDataSources {
        sources: vector<DataSource>,
    }

    public(friend) fun execute(state: &mut State, payload: vector<u8>) {
        let SetDataSources { sources } = from_byte_vec(payload);
        state::set_data_sources(state, sources);
    }

    fun from_byte_vec(bytes: vector<u8>): SetDataSources {
        let cursor = cursor::new(bytes);
        let data_sources_count = deserialize::deserialize_u8(&mut cursor);

        let sources = vector::empty();

        let i = 0;
        while (i < data_sources_count) {
            let emitter_chain_id = deserialize::deserialize_u16(&mut cursor);
            let emitter_address = external_address::new(bytes32::from_bytes(deserialize::deserialize_vector(&mut cursor, 32)));
            vector::push_back(&mut sources, data_source::new((emitter_chain_id as u64), emitter_address));

            i = i + 1;
        };

        cursor::destroy_empty(cursor);

        SetDataSources {
            sources
        }
    }
}
