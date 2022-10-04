module pyth::set_governance_data_source {
    use wormhole::cursor;
    use pyth::deserialize;
    use wormhole::external_address::{Self, ExternalAddress};
    use pyth::data_source;
    use pyth::state;

    friend pyth::governance;

    struct SetGovernanceDataSource {
        emitter_chain_id: u64,
        emitter_address: ExternalAddress,
        initial_sequence: u64,
    }

    public(friend) fun execute(payload: vector<u8>) {
        let SetGovernanceDataSource { emitter_chain_id, emitter_address, initial_sequence } = from_byte_vec(payload);
        state::set_governance_data_source(data_source::new(emitter_chain_id, emitter_address));
        state::set_last_executed_governance_sequence(initial_sequence);
    }

    fun from_byte_vec(bytes: vector<u8>): SetGovernanceDataSource {
        let cursor = cursor::init(bytes);
        let emitter_chain_id = deserialize::deserialize_u16(&mut cursor);
        let emitter_address = external_address::from_bytes(deserialize::deserialize_vector(&mut cursor, 32));
        let initial_sequence = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        SetGovernanceDataSource {
            emitter_chain_id,
            emitter_address,
            initial_sequence
        }
    }
}
