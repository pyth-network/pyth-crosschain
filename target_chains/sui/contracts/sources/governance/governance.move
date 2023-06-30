module pyth::governance {
    use pyth::governance_instruction;
    use pyth::governance_action;
    use pyth::set_governance_data_source;
    use pyth::set_data_sources;
    use pyth::set_stale_price_threshold;
    use pyth::set_fee_recipient;
    use pyth::state::{Self, State};
    use pyth::set_update_fee;
    use pyth::governance_witness::{GovernanceWitness};

    use wormhole::governance_message::{Self, DecreeReceipt};

    const E_INVALID_GOVERNANCE_ACTION: u64 = 0;
    const E_MUST_USE_CONTRACT_UPGRADE_MODULE_TO_DO_UPGRADES: u64 = 1;
    const E_CANNOT_EXECUTE_GOVERNANCE_ACTION_WITH_OBSOLETE_SEQUENCE_NUMBER: u64 = 2;

    /// Execute a governance instruction other than contract upgrade, which is
    /// handled separately in the contract_upgrade.move module.
    public fun execute_governance_instruction(
        pyth_state : &mut State,
        receipt: DecreeReceipt<GovernanceWitness>,
    ) {
        // This capability ensures that the current build version is used.
        let latest_only = state::assert_latest_only(pyth_state);

        // Get the sequence number of the governance VAA that was used to
        // generate the receipt.
        let sequence = governance_message::sequence(&receipt);

        // Require that new sequence number is greater than last executed sequence number.
        assert!(sequence > state::get_last_executed_governance_sequence(pyth_state),
            E_CANNOT_EXECUTE_GOVERNANCE_ACTION_WITH_OBSOLETE_SEQUENCE_NUMBER);

        // Update latest executed sequence number to current one.
        state::set_last_executed_governance_sequence(&latest_only, pyth_state, sequence);

        // governance_message::take_payload takes care of replay protection.
        let payload =
            governance_message::take_payload(
                state::borrow_mut_consumed_vaas(
                    &latest_only,
                    pyth_state
                ),
                receipt
            );

        let instruction = governance_instruction::from_byte_vec(payload);

        // Get the governance action.
        let action = governance_instruction::get_action(&instruction);

        // Dispatch the instruction to the appropriate handler.
        if (action == governance_action::new_contract_upgrade()) {
            abort(E_MUST_USE_CONTRACT_UPGRADE_MODULE_TO_DO_UPGRADES)
        } else if (action == governance_action::new_set_governance_data_source()) {
            set_governance_data_source::execute(&latest_only, pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_data_sources()) {
            set_data_sources::execute(&latest_only, pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_update_fee()) {
            set_update_fee::execute(&latest_only, pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_stale_price_threshold()) {
            set_stale_price_threshold::execute(&latest_only, pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_fee_recipient()) {
            set_fee_recipient::execute(&latest_only, pyth_state, governance_instruction::destroy(instruction));
        } else {
            governance_instruction::destroy(instruction);
            assert!(false, E_INVALID_GOVERNANCE_ACTION);
        }
    }
}
