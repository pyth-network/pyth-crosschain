module pyth::set_governance_data_source {
    use pyth::deserialize;
    use pyth::data_source;
    use pyth::state::{Self, State, LatestOnly};
    use pyth::governance_action::{Self};
    use pyth::governance_witness::{Self, GovernanceWitness};

    use wormhole::cursor;
    use wormhole::external_address::{Self, ExternalAddress};
    use wormhole::bytes32::{Self};
    use wormhole::governance_message::{Self, DecreeTicket};

    friend pyth::governance;

    struct GovernanceDataSource {
        emitter_chain_id: u64,
        emitter_address: ExternalAddress,
        initial_sequence: u64,
    }

    public fun authorize_governance(
        pyth_state: &State,
        global: bool
    ): DecreeTicket<GovernanceWitness> {
        if (global){
            governance_message::authorize_verify_global(
                governance_witness::new_governance_witness(),
                state::governance_chain(pyth_state),
                state::governance_contract(pyth_state),
                state::governance_module(),
                governance_action::get_value(governance_action::new_set_governance_data_source())
            )
        } else {
            governance_message::authorize_verify_local(
                governance_witness::new_governance_witness(),
                state::governance_chain(pyth_state),
                state::governance_contract(pyth_state),
                state::governance_module(),
                governance_action::get_value(governance_action::new_set_governance_data_source())
            )
        }
    }

    public(friend) fun execute(latest_only: &LatestOnly, pyth_state: &mut State, payload: vector<u8>) {
        let GovernanceDataSource { emitter_chain_id, emitter_address, initial_sequence: initial_sequence } = from_byte_vec(payload);
        state::set_governance_data_source(latest_only, pyth_state, data_source::new(emitter_chain_id, emitter_address));
        state::set_last_executed_governance_sequence(latest_only, pyth_state, initial_sequence);
    }

    fun from_byte_vec(bytes: vector<u8>): GovernanceDataSource {
        let cursor = cursor::new(bytes);
        let emitter_chain_id = deserialize::deserialize_u16(&mut cursor);
        let emitter_address = external_address::new(bytes32::from_bytes(deserialize::deserialize_vector(&mut cursor, 32)));
        let initial_sequence = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        GovernanceDataSource {
            emitter_chain_id: (emitter_chain_id as u64),
            emitter_address,
            initial_sequence
        }
    }
}

#[test_only]
module pyth::set_governance_data_source_tests {
    use sui::test_scenario::{Self};
    use sui::coin::Self;

    use wormhole::governance_message::verify_vaa;
    use wormhole::external_address::{Self};
    use wormhole::bytes32::{Self};

    use pyth::pyth_tests::{Self, setup_test, take_wormhole_and_pyth_states};
    use pyth::set_governance_data_source::{Self};
    use pyth::state::Self;
    use pyth::data_source::Self;

    const SET_GOVERNANCE_DATA_SOURCE_VAA: vector<u8> = x"0100000000010067ef04e15859d2fce645faca22921fb42c23f177efb2ebabf396d9155bd1fa2564af7829b1b9005415834d6eab06766d686601e52f6f0ca088639c0d09d5b1fa0000bc614e00000000000163278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c38500000000000000010100000000000000000000000000000000000000000000000000000000000000010100155054474d01020015010001a346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0";
    // VAA Info:
    //   module name: 0x1
    //   action: 2
    //   chain: 21
    //   governance data source (chain, addr): (1, a346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0)

    const DEPLOYER: address = @0x1234;
    const DEFAULT_BASE_UPDATE_FEE: u64 = 0;
    const DEFAULT_COIN_TO_MINT: u64 = 0;

    #[test]
    fun set_data_sources(){
        let (scenario, test_coins, clock) =  setup_test(500, 1, x"63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385", pyth_tests::data_sources_for_test_vaa(), vector[x"13947bd48b18e53fdaeee77f3473391ac727c638"], DEFAULT_BASE_UPDATE_FEE, DEFAULT_COIN_TO_MINT);
        test_scenario::next_tx(&mut scenario, DEPLOYER);
        let (pyth_state, worm_state) = take_wormhole_and_pyth_states(&scenario);

        let ticket = set_governance_data_source::authorize_governance(&pyth_state, false);

        let verified_vaa = wormhole::vaa::parse_and_verify(&mut worm_state, SET_GOVERNANCE_DATA_SOURCE_VAA, &clock);

        let receipt = verify_vaa(&worm_state, verified_vaa, ticket);

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        pyth::governance::execute_governance_instruction(&mut pyth_state, receipt);
        std::debug::print(&state::governance_data_source(&pyth_state));

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        // assert governance data source set correctly
        std::debug::print(&state::governance_data_source(&pyth_state));
        //std::debug::print();

        assert!(state::is_valid_governance_data_source(&pyth_state, data_source::new(1, external_address::new(bytes32::from_bytes(x"a346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0")))), 0);

        // clean up
        coin::burn_for_testing(test_coins);
        pyth_tests::cleanup_worm_state_pyth_state_and_clock(worm_state, pyth_state, clock);
        test_scenario::end(scenario);
    }
}
