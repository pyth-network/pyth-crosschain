module pyth::pyth {
    use std::vector;
    use sui::tx_context::{TxContext};

    use pyth::data_source::{Self, DataSource};
    //use pyth::set::{Self};
    use pyth::state::{Self};

    use wormhole::external_address::{Self};

    struct PythInitializationEvent has copy, drop {}

    fun init(
        stale_price_threshold: u64,
        governance_emitter_chain_id: u64,
        governance_emitter_address: vector<u8>,
        data_sources_emitter_chain_ids: vector<u64>,
        data_sources_emitter_addresses: vector<vector<u8>>,
        update_fee: u64,
        ctx: &mut TxContext
    ) {
        state::init_and_share_state(
            stale_price_threshold,
            update_fee,
            data_source::new(
                governance_emitter_chain_id,
                external_address::from_bytes(governance_emitter_address)),
            parse_data_sources(
                data_sources_emitter_chain_ids,
                data_sources_emitter_addresses,
            ),
            ctx
        )
    }

    fun parse_data_sources(
        emitter_chain_ids: vector<u64>,
        emitter_addresses: vector<vector<u8>>): vector<DataSource> {

        // TODO - add custom error type error::data_source_emitter_address_and_chain_ids_different_lengths()
        assert!(vector::length(&emitter_chain_ids) == vector::length(&emitter_addresses), 0);

        let sources = vector::empty();
        let i = 0;
        while (i < vector::length(&emitter_chain_ids)) {
            vector::push_back(&mut sources, data_source::new(
                *vector::borrow(&emitter_chain_ids, i),
                external_address::from_bytes(*vector::borrow(&emitter_addresses, i))
            ));

            i = i + 1;
        };
        sources
    }

}
