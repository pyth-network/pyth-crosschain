module pyth::governance_instruction {
    use wormhole::cursor;
    use pyth::deserialize;
    use pyth::error;
    use pyth::governance_action::{Self, GovernanceAction};
    use wormhole::u16;

    const MAGIC: vector<u8> = x"5054474d"; // "PTGM": Pyth Governance Message
    const MODULE: u8 = 1;

    struct GovernanceInstruction {
        module_: u8,
        action: GovernanceAction,
        target_chain_id: u64,
        payload: vector<u8>,
    }

    fun validate(instruction: &GovernanceInstruction) {
        assert!(instruction.module_ == MODULE, error::invalid_governance_module());
        let target_chain_id = instruction.target_chain_id;
        assert!(target_chain_id == u16::to_u64(wormhole::state::get_chain_id()) || target_chain_id == 0, error::invalid_governance_target_chain_id());
    }

    public fun from_byte_vec(bytes: vector<u8>): GovernanceInstruction {
        let cursor = cursor::init(bytes);
        let magic = deserialize::deserialize_vector(&mut cursor, 4);
        assert!(magic == MAGIC, error::invalid_governance_magic_value());
        let module_ = deserialize::deserialize_u8(&mut cursor);
        let action = governance_action::from_u8(deserialize::deserialize_u8(&mut cursor));
        let target_chain_id = deserialize::deserialize_u16(&mut cursor);
        let payload = cursor::rest(cursor);

        let instruction = GovernanceInstruction {
            module_,
            action,
            target_chain_id,
            payload
        };
        validate(&instruction);

        instruction
    }

    public fun get_module(instruction: &GovernanceInstruction): u8 {
        instruction.module_
    }

    public fun get_action(instruction: &GovernanceInstruction): GovernanceAction {
        instruction.action
    }

    public fun get_target_chain_id(instruction: &GovernanceInstruction): u64 {
        instruction.target_chain_id
    }

    public fun destroy(instruction: GovernanceInstruction): vector<u8> {
        let GovernanceInstruction {
            module_: _,
            action: _,
            target_chain_id: _,
            payload: payload
        } = instruction;
        payload
    }

    #[test]
    #[expected_failure(abort_code = 65556, location = pyth::governance_instruction)]
    fun test_from_byte_vec_invalid_magic() {
        let bytes = x"5054474eb01087a85361f738f19454e66664d3c9";
        destroy(from_byte_vec(bytes));
    }

    #[test]
    #[expected_failure(abort_code = 65548, location = pyth::governance_instruction)]
    fun test_from_byte_vec_invalid_module() {
        let bytes = x"5054474db00187a85361f738f19454e66664d3c9";
        destroy(from_byte_vec(bytes));
    }

    #[test]
    #[expected_failure(abort_code = 65548, location = pyth::governance_instruction)]
    fun test_from_byte_vec_invalid_target_chain_id() {
        let bytes = x"5054474db00187a85361f738f19454e66664d3c9";
        destroy(from_byte_vec(bytes));
    }
}
