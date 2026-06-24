module pyth::set_governance_data_source {
    use pyth::state::{State, LatestOnly};

    friend pyth::governance;

    /// Governance data source rotation has been disabled as a stopgap fix for a
    /// replay vulnerability. `WormholeVAAVerificationReceipt` does not bind to
    /// the data source it was verified against, so an in-PTB rotation (which
    /// also resets `last_executed_governance_sequence` to the payload-controlled
    /// `initial_sequence`) lets a sibling receipt verified under the old source
    /// pass the post-rotation monotonicity check and replay any historical
    /// SetDataSources / SetFeeRecipient / SetUpdateFee / SetStalePriceThreshold /
    /// ContractUpgrade VAA against the new governance source.
    ///
    /// A proper fix requires binding the data source to the receipt and
    /// re-checking it at execute time. Under Sui's `compatible` upgrade policy
    /// that can only ship as an additive V2 receipt + V2 function variants
    /// (changing the existing struct layout or function signatures is rejected
    /// by the upgrade verifier). Until that V2 upgrade lands, this function
    /// aborts so the rotation vector is closed.
    const E_GOVERNANCE_DATA_SOURCE_ROTATION_DISABLED: u64 = 0;

    public(friend) fun execute(_latest_only: &LatestOnly, _pyth_state: &mut State, _payload: vector<u8>) {
        abort E_GOVERNANCE_DATA_SOURCE_ROTATION_DISABLED
    }
}

#[test_only]
module pyth::set_governance_data_source_tests {
    use sui::test_scenario::{Self};
    use sui::coin::Self;

    use pyth::pyth_tests::{Self, setup_test, take_wormhole_and_pyth_states};

    // A signed Wormhole VAA carrying a Pyth `SetGovernanceDataSource` governance
    // action (module=1, action=1, target_chain=21). Signed by the well-known
    // Wormhole devnet guardian (priv `cfb12303...e113a0` → address
    // `0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe`) over governance emitter
    // chain 1 / address `63278d27...068c385`, sequence 1. Payload rotates the
    // governance source to chain 26 / address `f346195a...8697b0` with
    // `initial_sequence = 0`. The exact rotation values don't matter — we only
    // assert the action aborts before any state update lands.
    const SET_GOVERNANCE_DATA_SOURCE_VAA: vector<u8> = x"01000000000100101895ce77ebb22ac257a5cf4def92a52cff4ca1409f9375416c2c8f8a887dd65dfc8d34eb87312a1d5eee1ef694f6bbed357dda8ee7070dd9d505589dcc8dd4010000000000000000000163278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c3850000000000000001015054474d01010015001af346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b00000000000000000";

    const DEPLOYER: address = @0x1234;
    const DEFAULT_BASE_UPDATE_FEE: u64 = 0;
    const DEFAULT_COIN_TO_MINT: u64 = 0;

    #[test]
    #[expected_failure(abort_code = pyth::set_governance_data_source::E_GOVERNANCE_DATA_SOURCE_ROTATION_DISABLED)]
    fun test_set_governance_data_source_aborts() {
        let (scenario, test_coins, clock) = setup_test(500, 1, x"63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385", pyth_tests::data_sources_for_test_vaa(), vector[x"beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe"], DEFAULT_BASE_UPDATE_FEE, DEFAULT_COIN_TO_MINT);
        test_scenario::next_tx(&mut scenario, DEPLOYER);
        let (pyth_state, worm_state) = take_wormhole_and_pyth_states(&scenario);

        let verified_vaa = wormhole::vaa::parse_and_verify(&worm_state, SET_GOVERNANCE_DATA_SOURCE_VAA, &clock);

        let receipt = pyth::governance::verify_vaa(&pyth_state, verified_vaa);

        test_scenario::next_tx(&mut scenario, DEPLOYER);

        // The dispatcher routes this to `set_governance_data_source::execute`,
        // which now aborts with `E_GOVERNANCE_DATA_SOURCE_ROTATION_DISABLED`.
        pyth::governance::execute_governance_instruction(&mut pyth_state, receipt);

        // Unreachable; kept so the test compiles with all resources consumed.
        coin::burn_for_testing(test_coins);
        pyth_tests::cleanup_worm_state_pyth_state_and_clock(worm_state, pyth_state, clock);
        test_scenario::end(scenario);
    }
}
