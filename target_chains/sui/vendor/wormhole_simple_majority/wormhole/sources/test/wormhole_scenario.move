// SPDX-License-Identifier: Apache 2

#[test_only]
/// This module implements ways to initialize Wormhole in a test scenario. This
/// module includes a default method (`set_up_wormhole`) with only one of the
/// devnet (Tilt) Guardians. The private key for this Guardian is known (see the
/// main Wormhole repository at https://github.com/wormhole-foundation/wormhole
/// for the key), which allows an integrator to generate his own VAAs and
/// validate them with this test-only Wormhole instance.
module wormhole::wormhole_scenario {
    use std::vector::{Self};
    use sui::clock::{Self, Clock};
    use sui::package::{UpgradeCap};
    use sui::test_scenario::{Self, Scenario};

    use wormhole::emitter::{EmitterCap};
    use wormhole::governance_message::{Self, DecreeTicket, DecreeReceipt};
    use wormhole::setup::{Self, DeployerCap};
    use wormhole::state::{Self, State};
    use wormhole::vaa::{Self, VAA};

    const DEPLOYER: address = @0xDEADBEEF;
    const WALLET_1: address = @0xB0B1;
    const WALLET_2: address = @0xB0B2;
    const WALLET_3: address = @0xB0B3;
    const VAA_VERIFIER: address = @0xD00D;
    const EMITTER_MAKER: address = @0xFEED;

    /// Set up Wormhole with any guardian pubkeys. For most testing purposes,
    /// please use `set_up_wormhole` which only uses one guardian.
    ///
    /// NOTE: This also creates `Clock` for testing.
    public fun set_up_wormhole_with_guardians(
        scenario: &mut Scenario,
        message_fee: u64,
        initial_guardians: vector<vector<u8>>,
    ) {
        // Process effects prior. `init_test_only` will be executed as the
        // Wormhole contract deployer.
        test_scenario::next_tx(scenario, DEPLOYER);

        // `init` Wormhole contract as if it were published.
        wormhole::setup::init_test_only(test_scenario::ctx(scenario));

        // `init_and_share_state` will also be executed as the Wormhole deployer
        // to destroy the `DeployerCap` to create a sharable `State`.
        test_scenario::next_tx(scenario, DEPLOYER);

        // Parameters for Wormhole's `State` are common in the Wormhole testing
        // environment aside from the `guardian_set_epochs_to_live`, which at
        // the moment needs to be discussed on how to configure. As of now,
        // there is no clock with unix timestamp to expire guardian sets in
        // terms of human-interpretable time.
        {
            // This will be created and sent to the transaction sender
            // automatically when the contract is published. This exists in
            // place of grabbing it from the sender.
            let upgrade_cap =
                test_scenario::take_from_sender<UpgradeCap>(scenario);

            let governance_chain = 1;
            let governance_contract =
                x"0000000000000000000000000000000000000000000000000000000000000004";
            let guardian_set_index = 0;
            let guardian_set_seconds_to_live = 420;

            // Share `State`.
            setup::complete(
                test_scenario::take_from_address<DeployerCap>(
                    scenario, DEPLOYER
                ),
                upgrade_cap,
                governance_chain,
                governance_contract,
                guardian_set_index,
                initial_guardians,
                guardian_set_seconds_to_live,
                message_fee,
                test_scenario::ctx(scenario)
            );
        };

        // Done.
    }

    /// Set up Wormhole with only the first devnet guardian.
    public fun set_up_wormhole(scenario: &mut Scenario, message_fee: u64) {
        let initial_guardians = vector::empty();
        vector::push_back(
            &mut initial_guardians,
            *vector::borrow(&guardians(), 0)
        );

        set_up_wormhole_with_guardians(scenario, message_fee, initial_guardians)
    }

    /// Perform an upgrade (which just upticks the current version of what the
    /// `State` believes is true).
    public fun upgrade_wormhole(scenario: &mut Scenario) {
        // Clean up from activity prior.
        test_scenario::next_tx(scenario, person());

        let worm_state = take_state(scenario);
        state::test_upgrade(&mut worm_state);

        // Clean up.
        return_state(worm_state);
    }

    /// Address of wallet that published Wormhole contract.
    public fun deployer(): address {
        DEPLOYER
    }

    public fun person(): address {
        WALLET_1
    }

    public fun two_people(): (address, address) {
        (WALLET_1, WALLET_2)
    }

    public fun three_people(): (address, address, address) {
        (WALLET_1, WALLET_2, WALLET_3)
    }

    /// All guardians that exist in devnet (Tilt) environment.
    public fun guardians(): vector<vector<u8>> {
        vector[
            x"befa429d57cd18b7f8a4d91a2da9ab4af05d0fbe",
            x"88d7d8b32a9105d228100e72dffe2fae0705d31c",
            x"58076f561cc62a47087b567c86f986426dfcd000",
            x"bd6e9833490f8fa87c733a183cd076a6cbd29074",
            x"b853fcf0a5c78c1b56d15fce7a154e6ebe9ed7a2",
        ]
    }

    public fun take_state(scenario: &Scenario): State {
        test_scenario::take_shared(scenario)
    }

    public fun return_state(wormhole_state: State) {
        test_scenario::return_shared(wormhole_state);
    }

    public fun parse_and_verify_vaa(
        scenario: &mut Scenario,
        vaa_buf: vector<u8>
    ): VAA {
        test_scenario::next_tx(scenario, VAA_VERIFIER);

        let the_clock = take_clock(scenario);
        let worm_state = take_state(scenario);

        let out =
            vaa::parse_and_verify(
                &worm_state,
                vaa_buf,
                &the_clock
            );

        // Clean up.
        return_state(worm_state);
        return_clock(the_clock);

        out
    }

    public fun verify_governance_vaa<T>(
        scenario: &mut Scenario,
        verified_vaa: VAA,
        ticket: DecreeTicket<T>
    ): DecreeReceipt<T> {
        test_scenario::next_tx(scenario, VAA_VERIFIER);

        let worm_state = take_state(scenario);

        let receipt =
            governance_message::verify_vaa(&worm_state, verified_vaa, ticket);

        // Clean up.
        return_state(worm_state);

        receipt
    }

    public fun new_emitter(
        scenario: &mut Scenario
    ): EmitterCap {
        test_scenario::next_tx(scenario, EMITTER_MAKER);

        let worm_state = take_state(scenario);

        let emitter =
            wormhole::emitter::new(&worm_state, test_scenario::ctx(scenario));

        // Clean up.
        return_state(worm_state);

        emitter
    }

    public fun take_clock(scenario: &mut Scenario): Clock {
        clock::create_for_testing(test_scenario::ctx(scenario))
    }

    public fun return_clock(the_clock: Clock) {
        clock::destroy_for_testing(the_clock)
    }
}
