module pyth::governance {
    use sui::clock::{Clock};
    use sui::package::{UpgradeTicket};
    use sui::tx_context::{TxContext};

    use pyth::data_source::{Self};
    use pyth::governance_instruction;
    use pyth::governance_action;
    use pyth::contract_upgrade;
    use pyth::set_governance_data_source;
    use pyth::set_data_sources;
    use pyth::set_stale_price_threshold;
    use pyth::transfer_fee;
    use pyth::state::{State};
    use pyth::set_update_fee;
    use pyth::state;
    use pyth::contract_upgrade::{GovernanceWitness};

    use wormhole::vaa::{Self, VAA};
    use wormhole::state::{State as WormState};
    use wormhole::governance_message::{Self, DecreeReceipt};

    const E_GOVERNANCE_CONTRACT_UPGRADE_CHAIN_ID_ZERO: u64 = 0;
    const E_INVALID_GOVERNANCE_ACTION: u64 = 1;
    const E_INVALID_GOVERNANCE_DATA_SOURCE: u64 = 2;
    const E_MUST_USE_EXECUTE_CONTRACT_UPGRADE_GOVERNANCE_INSTRUCTION_CALLSITE: u64 = 3;
    const E_GOVERNANCE_ACTION_MUST_BE_CONTRACT_UPGRADE: u64 = 4;

    /// Rather than having execute_governance_instruction handle the contract
    /// upgrade governance instruction, we have a separate function that processes
    /// contract upgrade instructions, because doing contract upgrades is a
    /// multi-step process, and the first step of doing a contract upgrade
    /// yields a return value, namely the upgrade ticket, which is non-droppable.
    public fun execute_contract_upgrade_governance_instruction(
        pyth_state : &mut State,
        worm_state: &WormState,
        vaa_bytes: vector<u8>,
        clock: &Clock
    ): UpgradeTicket {
        let parsed_vaa = parse_and_verify_and_replay_protect_governance_vaa(pyth_state, worm_state, vaa_bytes, clock);
        let instruction = governance_instruction::from_byte_vec(vaa::take_payload(parsed_vaa));
        let action = governance_instruction::get_action(&instruction);
        assert!(action == governance_action::new_contract_upgrade(),
            E_GOVERNANCE_ACTION_MUST_BE_CONTRACT_UPGRADE);
        assert!(governance_instruction::get_target_chain_id(&instruction) != 0,
            E_GOVERNANCE_CONTRACT_UPGRADE_CHAIN_ID_ZERO);
        contract_upgrade::execute(pyth_state, governance_instruction::destroy(instruction))
    }

    /// Execute a governance instruction.
    public entry fun execute_governance_instruction(
        pyth_state : &mut State,
        receipt: DecreeReceipt<GovernanceWitness>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // This capability ensures that the current build version is used.
        let latest_only = state::assert_latest_only(pyth_state);

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

        // Dispatch the instruction to the appropiate handler.
        if (action == governance_action::new_contract_upgrade()) {
            abort(E_MUST_USE_EXECUTE_CONTRACT_UPGRADE_GOVERNANCE_INSTRUCTION_CALLSITE)
        } else if (action == governance_action::new_set_governance_data_source()) {
            set_governance_data_source::execute(&latest_only, pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_data_sources()) {
            set_data_sources::execute(&latest_only, pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_update_fee()) {
            set_update_fee::execute(&latest_only, pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_set_stale_price_threshold()) {
            set_stale_price_threshold::execute(&latest_only, pyth_state, governance_instruction::destroy(instruction));
        } else if (action == governance_action::new_transfer_fee()) {
            transfer_fee::execute(&latest_only, pyth_state, governance_instruction::destroy(instruction), ctx);
        } else {
            governance_instruction::destroy(instruction);
            assert!(false, E_INVALID_GOVERNANCE_ACTION);
        }
    }
}

// TODO - add tests
