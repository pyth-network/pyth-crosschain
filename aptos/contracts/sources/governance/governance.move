module pyth::governance {
    use wormhole::vaa::{Self, VAA};
    use pyth::data_source;
    use wormhole::u16;
    use pyth::governance_instruction;
    use pyth::governance_action;
    use pyth::contract_upgrade;
    use pyth::set_governance_data_source;
    use pyth::set_data_sources;
    use pyth::set_stale_price_threshold;
    use pyth::error;
    use pyth::set_update_fee;
    use pyth::state;

    public entry fun execute_governance_instruction(vaa_bytes: vector<u8>) {
        let parsed_vaa = parse_and_verify_governance_vaa(vaa_bytes);
        let instruction = governance_instruction::from_byte_vec(vaa::destroy(parsed_vaa));

        // Dispatch the instruction to the appropiate handler
        let action = governance_instruction::get_action(&instruction);
        if (action == governance_action::destroy(governance_action::new_contract_upgrade())) {
            contract_upgrade::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::destroy(governance_action::new_set_governance_data_source())) {
            set_governance_data_source::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::destroy(governance_action::new_set_data_sources())) {
            set_data_sources::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::destroy(governance_action::new_set_update_fee())) {
            set_update_fee::execute(governance_instruction::destroy(instruction));
        } else if (action == governance_action::destroy(governance_action::new_set_stale_price_threshold())) {
            set_stale_price_threshold::execute(governance_instruction::destroy(instruction));
        } else {
            governance_instruction::destroy(instruction);
            assert!(false, error::invalid_governance_action());
        }
    }

    fun parse_and_verify_governance_vaa(bytes: vector<u8>): VAA {
        let parsed_vaa = vaa::parse_and_verify(bytes);

        // Check that the governance data source is valid
        assert!(
            state::is_valid_governance_data_source(
                data_source::new(
                    u16::to_u64(vaa::get_emitter_chain(&parsed_vaa)),
                    vaa::get_emitter_address(&parsed_vaa))),
            error::invalid_governance_data_source());

        // Check that the sequence number is greater than the last executed governance VAA
        let sequence = vaa::get_sequence(&parsed_vaa);
        assert!(sequence > state::get_last_executed_governance_sequence(), error::invalid_governance_sequence_number());
        state::set_last_executed_governance_sequence(sequence);

        parsed_vaa
    }
}
