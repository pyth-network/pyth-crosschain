module pyth::set_update_fee {
    use sui::math::{Self};

    use wormhole::cursor;
    use wormhole::governance_message::{Self, DecreeTicket};

    use pyth::deserialize;
    use pyth::state::{Self, State, LatestOnly};
    use pyth::governance_action::{Self};
    use pyth::governance_witness::{Self, GovernanceWitness};

    friend pyth::governance;

    const MAX_U64: u128 = (1 << 64) - 1;
    const E_EXPONENT_DOES_NOT_FIT_IN_U8: u64 = 0;

    struct UpdateFee {
        mantissa: u64,
        exponent: u64,
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
                governance_action::get_value(governance_action::new_set_update_fee())
            )
        } else{
                governance_message::authorize_verify_local(
                governance_witness::new_governance_witness(),
                state::governance_chain(pyth_state),
                state::governance_contract(pyth_state),
                state::governance_module(),
                governance_action::get_value(governance_action::new_set_update_fee())
            )
        }

    }

    public(friend) fun execute(latest_only: &LatestOnly, pyth_state: &mut State, payload: vector<u8>) {
        let UpdateFee { mantissa, exponent } = from_byte_vec(payload);
        assert!(exponent <= 255, E_EXPONENT_DOES_NOT_FIT_IN_U8);
        let fee = apply_exponent(mantissa, (exponent as u8));
        state::set_base_update_fee(latest_only, pyth_state, fee);
    }

    fun from_byte_vec(bytes: vector<u8>): UpdateFee {
        let cursor = cursor::new(bytes);
        let mantissa = deserialize::deserialize_u64(&mut cursor);
        let exponent = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        UpdateFee {
            mantissa,
            exponent,
        }
    }

    fun apply_exponent(mantissa: u64, exponent: u8): u64 {
        mantissa * math::pow(10, exponent)
    }
}

#[test_only]
module pyth::set_update_fee_tests {
    use sui::test_scenario::{Self};
    use sui::coin::Self;

    use wormhole::governance_message::verify_vaa;

    use pyth::pyth_tests::{Self, setup_test, take_wormhole_and_pyth_states};
    use pyth::set_update_fee::{Self};
    use pyth::state::Self;

    const SET_FEE_VAA: vector<u8> = x"01000000000100e773bfd4a262ecd012333a953aadd243b8c116cc059b970ecb91216675eff89a39438570efb6eedcea15dad71d6ad0a18a7d01617e3cf61d53339df705a36df00100bc614e00000000000163278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c38500000000000000010100000000000000000000000000000000000000000000000000000000000000010300155054474d0103001500000000000000030000000000000002";
    // VAA Info:
    //   module name: 0x1
    //   action: 3
    //   chain: 21
    //   new fee: 3, new exponent: 2

    const DEPLOYER: address = @0x1234;
    const DEFAULT_BASE_UPDATE_FEE: u64 = 0;
    const DEFAULT_COIN_TO_MINT: u64 = 0;

    #[test]
    fun set_update_fee(){

        let (scenario, test_coins, clock) =  setup_test(500, 1, x"63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385", pyth_tests::data_sources_for_test_vaa(), vector[x"13947bd48b18e53fdaeee77f3473391ac727c638"], DEFAULT_BASE_UPDATE_FEE, DEFAULT_COIN_TO_MINT);
        test_scenario::next_tx(&mut scenario, DEPLOYER);
        let (pyth_state, worm_state) = take_wormhole_and_pyth_states(&scenario);

        let ticket = set_update_fee::authorize_governance(&pyth_state, false);

        let verified_vaa = wormhole::vaa::parse_and_verify(&mut worm_state, SET_FEE_VAA, &clock);

        let receipt = verify_vaa(&worm_state, verified_vaa, ticket);

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        pyth::governance::execute_governance_instruction(&mut pyth_state, receipt);

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        // assert fee is set correctly
        assert!(state::get_base_update_fee(&pyth_state)==300, 0);

        // clean up
        coin::burn_for_testing(test_coins);
        pyth_tests::cleanup_worm_state_pyth_state_and_clock(worm_state, pyth_state, clock);
        test_scenario::end(scenario);
    }
}
