module pyth::governance_instruction {
    use wormhole::cursor;
    use pyth::deserialize;
    use pyth::error;

    const MODULE: u8 = 2;
    const TARGET_CHAIN_ID: u64 = 3;

    struct GovernanceInstruction {
        module_: u8,
        action: u8,
        target_chain_id: u64,
        payload: vector<u8>,
    }

    fun validate(instruction: &GovernanceInstruction) {
        assert!(instruction.module_ == MODULE, error::invalid_governance_module());
        let target_chain_id = instruction.target_chain_id;
        assert!(target_chain_id == TARGET_CHAIN_ID || target_chain_id == 0, error::invalid_governance_target_chain_id());
    }
 
    public fun from_byte_vec(bytes: vector<u8>): GovernanceInstruction {
        let cursor = cursor::init(bytes);
        let module_ = deserialize::deserialize_u8(&mut cursor);
        let action = deserialize::deserialize_u8(&mut cursor);
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

    public fun get_action(instruction: &GovernanceInstruction): u8 {
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
}
