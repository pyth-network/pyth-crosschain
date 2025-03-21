module pyth::governance {
    use pyth::governance_instruction;
    use pyth::governance_action;
    use pyth::set_governance_data_source;
    use pyth::set_data_sources;
    use pyth::set_stale_price_threshold;
    use pyth::set_fee_recipient;
    use pyth::state::{Self, State};
    use pyth::set_update_fee;

    use wormhole::vaa::{Self, VAA};
    use wormhole::bytes32::Bytes32;

    const E_INVALID_GOVERNANCE_ACTION: u64 = 0;
    const E_MUST_USE_CONTRACT_UPGRADE_MODULE_TO_DO_UPGRADES: u64 = 1;
    const E_CANNOT_EXECUTE_GOVERNANCE_ACTION_WITH_OBSOLETE_SEQUENCE_NUMBER: u64 = 2;
    const E_INVALID_GOVERNANCE_DATA_SOURCE: u64 = 4;

    // this struct does not have the store or key ability so it must be
    // used in the same txn chain in which it is created
    struct WormholeVAAVerificationReceipt{
        payload: vector<u8>,
        digest: Bytes32,
        sequence: u64,  // used for replay protection
    }

    public fun take_payload(receipt: &WormholeVAAVerificationReceipt): vector<u8> {
        receipt.payload
    }

    public fun take_digest(receipt: &WormholeVAAVerificationReceipt): Bytes32 {
        receipt.digest
    }

    public fun take_sequence(receipt: &WormholeVAAVerificationReceipt): u64 {
        receipt.sequence
    }

    public fun destroy(receipt: WormholeVAAVerificationReceipt) {
        let WormholeVAAVerificationReceipt{payload: _, digest: _, sequence: _} = receipt;
    }

    // We define a custom verify_vaa function instead of using wormhole::governance_message::verify_vaa
    // because that function makes extra assumptions about the VAA payload headers. Pyth uses a
    // different header format compared to Wormhole, so
    public fun verify_vaa(
        pyth_state: &State,
        verified_vaa: VAA,
    ): WormholeVAAVerificationReceipt {
        state::assert_latest_only(pyth_state);

        let vaa_data_source = pyth::data_source::new((vaa::emitter_chain(&verified_vaa) as u64), vaa::emitter_address(&verified_vaa));

        // The emitter chain and address must correspond to the Pyth governance emitter chain and contract.
        assert!(
            pyth::state::is_valid_governance_data_source(pyth_state, vaa_data_source),
            E_INVALID_GOVERNANCE_DATA_SOURCE
        );

        let digest = vaa::digest(&verified_vaa);

        let sequence = vaa::sequence(&verified_vaa);

        let payload = vaa::take_payload(verified_vaa);

        WormholeVAAVerificationReceipt { payload, digest, sequence }
    }

    /// Execute a governance instruction other than contract upgrade, which is
    /// handled separately in the contract_upgrade.move module.
    public fun execute_governance_instruction(
        pyth_state : &mut State,
        receipt: WormholeVAAVerificationReceipt,
    ) {
        // This capability ensures that the current build version is used.
        let latest_only = state::assert_latest_only(pyth_state);

        // Get the sequence number of the governance VAA that was used to
        // generate the receipt.
        let sequence = receipt.sequence;

        // Require that new sequence number is greater than last executed sequence number.
        assert!(sequence > state::get_last_executed_governance_sequence(pyth_state),
            E_CANNOT_EXECUTE_GOVERNANCE_ACTION_WITH_OBSOLETE_SEQUENCE_NUMBER);

        // Update latest executed sequence number to current one.
        state::set_last_executed_governance_sequence(&latest_only, pyth_state, sequence);

        let payload = receipt.payload;

        destroy(receipt);

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
