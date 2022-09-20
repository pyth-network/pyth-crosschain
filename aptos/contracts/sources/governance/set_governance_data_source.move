module pyth::set_governance_data_source {
    use wormhole::cursor;
    use pyth::deserialize;
    use wormhole::external_address::{Self, ExternalAddress};
    use pyth::data_source;
    use pyth::state;

    struct SetGovernanceDataSource {
        emitter_chain_id: u64,
        emitter_address: ExternalAddress,
    }

    public fun execute(payload: vector<u8>) {
        let SetGovernanceDataSource { emitter_chain_id, emitter_address } = from_byte_vec(payload);
        state::set_governance_data_source(data_source::new(emitter_chain_id, emitter_address));
    }

    fun from_byte_vec(bytes: vector<u8>): SetGovernanceDataSource {
        let cursor = cursor::init(bytes);
        let emitter_chain_id = deserialize::deserialize_u16(&mut cursor);
        let emitter_address = external_address::from_bytes(deserialize::deserialize_vector(&mut cursor, 32));
        cursor::destroy_empty(cursor);
        SetGovernanceDataSource {
            emitter_chain_id,
            emitter_address
        }
    }
}
