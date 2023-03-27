module pyth::governance {
    use sui::tx_context::{TxContext};

    use pyth::data_source::{Self};
    use pyth::governance_instruction;
    use pyth::governance_action;
    //use pyth::contract_upgrade;
    use pyth::set_governance_data_source;
    use pyth::set_data_sources;
    use pyth::set_stale_price_threshold;
    use pyth::state::{State};
    use pyth::set_update_fee;
    use pyth::state;

    use wormhole::vaa::{Self, VAA};
    use wormhole::state::{State as WormState};

    public entry fun execute_governance_instruction(
        vaa_bytes: vector<u8>,
        worm_state: &mut WormState,
        ctx: &mut TxContext
    ) {
        let parsed_vaa = parse_and_verify_governance_vaa(vaa_bytes, ctx);
        let instruction = governance_instruction::from_byte_vec(vaa::destroy(parsed_vaa));

        // Dispatch the instruction to the appropiate handler
        let action = governance_instruction::get_action(&instruction);
        if (action == governance_action::new_contract_upgrade()) {
            assert!(governance_instruction::get_target_chain_id(&instruction) != 0,
                error::governance_contract_upgrade_chain_id_zero());
            contract_upgrade::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_governance_data_source()) {
            set_governance_data_source::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_data_sources()) {
            set_data_sources::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_update_fee()) {
            set_update_fee::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_stale_price_threshold()) {
            set_stale_price_threshold::execute(governance_instruction::destroy(instruction));
        } else {
            governance_instruction::destroy(instruction);
            assert!(false, error::invalid_governance_action());
        }
    }

    fun parse_and_verify_governance_vaa(
        pyth_state: &mut State,
        worm_state: &WormState,
        bytes: vector<u8>,
        ctx: &mut TxContext
    ): VAA {
        let parsed_vaa = vaa::parse_and_verify(worm_state, bytes, ctx);

        // Check that the governance data source is valid
        assert!(
            state::is_valid_governance_data_source(
                pyth_state,
                data_source::new(
                    (vaa::emitter_chain(&parsed_vaa) as u64),
                    vaa::emitter_address(&parsed_vaa))),
            0); // TODO - error::invalid_governance_data_source()

        // Check that the sequence number is greater than the last executed governance VAA
        let sequence = vaa::sequence(&parsed_vaa);
        assert!(sequence > state::get_last_executed_governance_sequence(pyth_state), 0); // TODO - error::invalid_governance_sequence_number()
        state::set_last_executed_governance_sequence(pyth_state, sequence);

        parsed_vaa
    }
}

// TODO - add tests