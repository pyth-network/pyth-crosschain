module pyth::set_update_fee {
    use sui::math::{Self};

    use wormhole::cursor;

    use pyth::deserialize;
    use pyth::state::{Self, State, LatestOnly};

    friend pyth::governance;

    const MAX_U64: u128 = (1 << 64) - 1;
    const E_EXPONENT_DOES_NOT_FIT_IN_U8: u64 = 0;

    struct UpdateFee {
        mantissa: u64,
        exponent: u64,
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

    use pyth::pyth_tests::{Self, setup_test, take_wormhole_and_pyth_states};
    use pyth::state::Self;

    const SET_FEE_VAA: vector<u8> = x"010000000001009f843a3359e75940cad00eaec50a1ac075aca3248634576437cfd53d95c2e29859a3a1902a3ef3e0529b434cf63ce96b21e4e6c05204ba62a446371aa132174000527e4f9b000000010032f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf0000000000000001005054474d0103001600000000000000110000000000000003";
    // VAA Info:
    //   module name: 0x1
    //   action: 3
    //   chain: 21
    //   new fee: 3, new exponent: 2

    const DEPLOYER: address = @0x1234;
    const DEFAULT_BASE_UPDATE_FEE: u64 = 0;
    const DEFAULT_COIN_TO_MINT: u64 = 0;

    #[test]
    fun test_set_update_fee(){

        let (scenario, test_coins, clock) =  setup_test(500, 50, x"f06413c0148c78916554f134dcd17a7c8029a3a2bda475a4a1182305c53078bf", pyth_tests::data_sources_for_test_vaa(), vector[x"beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe"], DEFAULT_BASE_UPDATE_FEE, DEFAULT_COIN_TO_MINT);
        test_scenario::next_tx(&mut scenario, DEPLOYER);
        let (pyth_state, worm_state) = take_wormhole_and_pyth_states(&scenario);

        let verified_vaa = wormhole::vaa::parse_and_verify(&mut worm_state, SET_FEE_VAA, &clock);

        let receipt = pyth::governance::verify_vaa(&pyth_state, &worm_state, verified_vaa);

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        pyth::governance::execute_governance_instruction(&mut pyth_state, receipt);

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        // assert fee is set correctly
        assert!(state::get_base_update_fee(&pyth_state)==17000, 0);

        // clean up
        coin::burn_for_testing(test_coins);
        pyth_tests::cleanup_worm_state_pyth_state_and_clock(worm_state, pyth_state, clock);
        test_scenario::end(scenario);
    }
}
