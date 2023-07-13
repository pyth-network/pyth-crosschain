module pyth::set_stale_price_threshold {
    use wormhole::cursor;
    use wormhole::governance_message::{Self, DecreeTicket};

    use pyth::deserialize;
    use pyth::state::{Self, State, LatestOnly};
    use pyth::governance_action::{Self};
    use pyth::governance_witness::{Self, GovernanceWitness};

    friend pyth::governance;

    struct StalePriceThreshold {
        threshold: u64,
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
                governance_action::get_value(governance_action::new_set_stale_price_threshold())
            )
        } else{
            governance_message::authorize_verify_local(
                governance_witness::new_governance_witness(),
                state::governance_chain(pyth_state),
                state::governance_contract(pyth_state),
                state::governance_module(),
                governance_action::get_value(governance_action::new_set_stale_price_threshold())
            )
        }
    }

    public(friend) fun execute(latest_only: &LatestOnly, state: &mut State, payload: vector<u8>) {
        let StalePriceThreshold { threshold } = from_byte_vec(payload);
        state::set_stale_price_threshold_secs(latest_only, state, threshold);
    }

    fun from_byte_vec(bytes: vector<u8>): StalePriceThreshold {
        let cursor = cursor::new(bytes);
        let threshold = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        StalePriceThreshold {
            threshold
        }
    }
}

#[test_only]
module pyth::set_stale_price_threshold_test {
    use sui::test_scenario::{Self};
    use sui::coin::Self;

    use wormhole::governance_message::verify_vaa;

    use pyth::pyth_tests::{Self, setup_test, take_wormhole_and_pyth_states};
    use pyth::set_stale_price_threshold::{Self};
    use pyth::state::Self;

    const SET_STALE_PRICE_THRESHOLD_VAA: vector<u8> = x"01000000000100196a91724d472b6c160c44ddcc9f9cef531aa95442739300023048bd066b77ca1a02bbfd9ff1799f3d63a4dd10c5348ab3b231e3bb66232e0cb4c07daa3647090100bc614e00000000000163278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c38500000000000000010100000000000000000000000000000000000000000000000000000000000000010400155054474d0104001500000000000aee23";
    // VAA Info:
    //   module name: 0x1
    //   action: 4
    //   chain: 21
    //   stale price threshold: 716323

    const DEPLOYER: address = @0x1234;
    const DEFAULT_BASE_UPDATE_FEE: u64 = 0;
    const DEFAULT_COIN_TO_MINT: u64 = 0;

    #[test]
    fun set_stale_price_threshold(){

        let (scenario, test_coins, clock) =  setup_test(500, 1, x"63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385", pyth_tests::data_sources_for_test_vaa(), vector[x"13947bd48b18e53fdaeee77f3473391ac727c638"], DEFAULT_BASE_UPDATE_FEE, DEFAULT_COIN_TO_MINT);
        test_scenario::next_tx(&mut scenario, DEPLOYER);
        let (pyth_state, worm_state) = take_wormhole_and_pyth_states(&scenario);

        let ticket = set_stale_price_threshold::authorize_governance(&pyth_state, false);

        let verified_vaa = wormhole::vaa::parse_and_verify(&mut worm_state, SET_STALE_PRICE_THRESHOLD_VAA, &clock);

        let receipt = verify_vaa(&worm_state, verified_vaa, ticket);

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        pyth::governance::execute_governance_instruction(&mut pyth_state, receipt);

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        // assert stale price threshold is set correctly
        assert!(state::get_stale_price_threshold_secs(&pyth_state)==716323, 0);

        // clean up
        coin::burn_for_testing(test_coins);
        pyth_tests::cleanup_worm_state_pyth_state_and_clock(worm_state, pyth_state, clock);
        test_scenario::end(scenario);
    }
}
