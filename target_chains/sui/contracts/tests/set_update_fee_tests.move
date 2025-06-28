#[test_only]
module pyth::set_update_fee_tests;

use pyth::pyth_tests::{Self, setup_test, take_wormhole_and_pyth_states};
use pyth::state;
use sui::coin;
use sui::test_scenario;

const SET_FEE_VAA: vector<u8> =
    x"01000000000100189d01616814b185b5a26bde6123d48e0d44dd490bbb3bde5d12076247b2180068a8261165777076ae532b7b0739aaee6411c8ba0695d20d4fa548227ce15d8d010000000000000000000163278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c3850000000000000001015054474d0103001500000000000000050000000000000005";
// VAA Info:
//   module name: 0x1
//   action: 3
//   chain: 21
//   new fee: 5, new exponent: 5

const DEPLOYER: address = @0x1234;
const DEFAULT_BASE_UPDATE_FEE: u64 = 0;
const DEFAULT_COIN_TO_MINT: u64 = 0;

#[test]
fun test_set_update_fee() {
    let (mut scenario, test_coins, clock) = setup_test(
        500,
        1,
        x"63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385",
        pyth_tests::data_sources_for_test_vaa(),
        vector[x"13947bd48b18e53fdaeee77f3473391ac727c638"],
        DEFAULT_BASE_UPDATE_FEE,
        DEFAULT_COIN_TO_MINT,
    );
    test_scenario::next_tx(&mut scenario, DEPLOYER);
    let (mut pyth_state, worm_state) = take_wormhole_and_pyth_states(&scenario);

    let verified_vaa = wormhole::vaa::parse_and_verify(&worm_state, SET_FEE_VAA, &clock);

    let receipt = pyth::governance::verify_vaa(&pyth_state, verified_vaa);

    test_scenario::next_tx(&mut scenario, DEPLOYER);

    pyth::governance::execute_governance_instruction(&mut pyth_state, receipt);

    test_scenario::next_tx(&mut scenario, DEPLOYER);

    // assert fee is set correctly
    assert!(state::get_base_update_fee(&pyth_state)==500000, 0);

    // clean up
    coin::burn_for_testing(test_coins);
    pyth_tests::cleanup_worm_state_pyth_state_and_clock(worm_state, pyth_state, clock);
    test_scenario::end(scenario);
}
