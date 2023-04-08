module pyth::governance {
    use sui::clock::{Clock};

    use pyth::data_source::{Self};
    use pyth::governance_instruction;
    use pyth::governance_action;
    use pyth::contract_upgrade;
    use pyth::set_governance_data_source;
    use pyth::set_data_sources;
    use pyth::set_stale_price_threshold;
    use pyth::state::{State};
    use pyth::set_update_fee;
    use pyth::state;

    use wormhole::vaa::{Self, VAA};
    use wormhole::state::{State as WormState};

    const E_GOVERNANCE_CONTRACT_UPGRADE_CHAIN_ID_ZERO: u64 = 0;
    const E_INVALID_GOVERNANCE_ACTION: u64 = 1;
    const E_INVALID_GOVERNANCE_DATA_SOURCE: u64 = 2;
    const E_INVALID_GOVERNANCE_SEQUENCE_NUMBER: u64 = 3;

    public entry fun execute_governance_instruction(
        pyth_state : &mut State,
        worm_state: &WormState,
        vaa_bytes: vector<u8>,
        clock: &Clock
    ) {
        let parsed_vaa = parse_and_verify_governance_vaa(pyth_state, worm_state, vaa_bytes, clock);
        let instruction = governance_instruction::from_byte_vec(vaa::take_payload(parsed_vaa));

        // Dispatch the instruction to the appropiate handler
        let action = governance_instruction::get_action(&instruction);
        if (action == governance_action::new_contract_upgrade()) {
            assert!(governance_instruction::get_target_chain_id(&instruction) != 0,
                E_GOVERNANCE_CONTRACT_UPGRADE_CHAIN_ID_ZERO);
            contract_upgrade::execute(worm_state, pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_governance_data_source()) {
            set_governance_data_source::execute(pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_data_sources()) {
            set_data_sources::execute(pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_update_fee()) {
            set_update_fee::execute(pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_stale_price_threshold()) {
            set_stale_price_threshold::execute(pyth_state, governance_instruction::destroy(instruction));
        } else {
            governance_instruction::destroy(instruction);
            assert!(false, E_INVALID_GOVERNANCE_ACTION);
        }
    }

    fun parse_and_verify_governance_vaa(
        pyth_state: &mut State,
        worm_state: &WormState,
        bytes: vector<u8>,
        clock: &Clock,
    ): VAA {
        let parsed_vaa = vaa::parse_and_verify(worm_state, bytes, clock);

        // Check that the governance data source is valid
        assert!(
            state::is_valid_governance_data_source(
                pyth_state,
                data_source::new(
                    (vaa::emitter_chain(&parsed_vaa) as u64),
                    vaa::emitter_address(&parsed_vaa))),
            E_INVALID_GOVERNANCE_DATA_SOURCE);

        // Check that the sequence number is greater than the last executed governance VAA
        let sequence = vaa::sequence(&parsed_vaa);
        assert!(sequence > state::get_last_executed_governance_sequence(pyth_state), E_INVALID_GOVERNANCE_SEQUENCE_NUMBER);
        state::set_last_executed_governance_sequence(pyth_state, sequence);

        parsed_vaa
    }
}

// TODO - add tests
