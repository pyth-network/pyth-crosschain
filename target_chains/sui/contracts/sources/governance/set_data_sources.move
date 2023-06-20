module pyth::set_data_sources {
    use std::vector;

    use wormhole::cursor;
    use wormhole::external_address::{Self};
    use wormhole::bytes32::{Self};
    use wormhole::governance_message::{Self, DecreeTicket};

    use pyth::deserialize;
    use pyth::data_source::{Self, DataSource};
    use pyth::state::{Self, State, LatestOnly};
    use pyth::governance_action::{Self};
    use pyth::governance_witness::{Self, GovernanceWitness};

    friend pyth::governance;

    struct DataSources {
        sources: vector<DataSource>,
    }

    public fun authorize_governance(
        pyth_state: &State,
        global: bool
    ): DecreeTicket<GovernanceWitness> {
        if (global) {
            governance_message::authorize_verify_global(
                governance_witness::new_governance_witness(),
                state::governance_chain(pyth_state),
                state::governance_contract(pyth_state),
                state::governance_module(),
                governance_action::get_value(governance_action::new_set_data_sources())
            )
        } else {
            governance_message::authorize_verify_local(
                governance_witness::new_governance_witness(),
                state::governance_chain(pyth_state),
                state::governance_contract(pyth_state),
                state::governance_module(),
                governance_action::get_value(governance_action::new_set_data_sources())
            )
        }
    }

    public(friend) fun execute(
        latest_only: &LatestOnly,
        state: &mut State,
        payload: vector<u8>
    ) {
        let DataSources { sources } = from_byte_vec(payload);
        state::set_data_sources(latest_only, state, sources);
    }

    fun from_byte_vec(bytes: vector<u8>): DataSources {
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

        DataSources {
            sources
        }
    }
}
