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

#[test_only]
module pyth::set_data_sources_tests {
    use sui::test_scenario::{Self};
    use sui::coin::Self;

    use wormhole::governance_message::verify_vaa;
    use wormhole::external_address::{Self};
    use wormhole::bytes32::{Self};

    use pyth::pyth_tests::{Self, setup_test, take_wormhole_and_pyth_states};
    use pyth::set_data_sources::{Self};
    use pyth::state::Self;
    use pyth::data_source::Self;

    const SET_DATA_SOURCES_VAA: vector<u8> = x"01000000000100ac52663a7e50ab23db4f00f0607d930ffd438c5a214b3013418b57117590f76c32d2f790ec62be5f6e69d96273b1a567b8a698a8f5069c1ccd27a6874af2adc00100bc614e00000000000163278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c38500000000000000010100000000000000000000000000000000000000000000000000000000000000010200155054474d01020015030001f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0001aa27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6001ae101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71";
    // VAA Info:
    //   module name: 0x1
    //   action: 2
    //   chain: 21
    //   data sources (chain, addr) pairs: [(1, 0xf346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0), (26, 0xa27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6), (26, 0xe101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71)]

    const DEPLOYER: address = @0x1234;
    const DEFAULT_BASE_UPDATE_FEE: u64 = 0;
    const DEFAULT_COIN_TO_MINT: u64 = 0;

    #[test]
    fun set_data_sources(){
        let (scenario, test_coins, clock) =  setup_test(500, 1, x"63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385", pyth_tests::data_sources_for_test_vaa(), vector[x"13947bd48b18e53fdaeee77f3473391ac727c638"], DEFAULT_BASE_UPDATE_FEE, DEFAULT_COIN_TO_MINT);
        test_scenario::next_tx(&mut scenario, DEPLOYER);
        let (pyth_state, worm_state) = take_wormhole_and_pyth_states(&scenario);

        let ticket = set_data_sources::authorize_governance(&pyth_state, false);

        let verified_vaa = wormhole::vaa::parse_and_verify(&mut worm_state, SET_DATA_SOURCES_VAA, &clock);

        let receipt = verify_vaa(&worm_state, verified_vaa, ticket);

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        pyth::governance::execute_governance_instruction(&mut pyth_state, receipt);

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        // assert data sources are set correctly

        assert!(state::is_valid_data_source(&pyth_state, data_source::new(1, external_address::new(bytes32::from_bytes(x"f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0")))), 0);
        assert!(state::is_valid_data_source(&pyth_state, data_source::new(26, external_address::new(bytes32::from_bytes(x"a27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6")))), 0);
        assert!(state::is_valid_data_source(&pyth_state, data_source::new(26, external_address::new(bytes32::from_bytes(x"e101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71")))), 0);

        // clean up
        coin::burn_for_testing(test_coins);
        pyth_tests::cleanup_worm_state_pyth_state_and_clock(worm_state, pyth_state, clock);
        test_scenario::end(scenario);
    }
}
