use core::panic_with_felt252;
use pyth::reader::{Reader, ReaderImpl};
use pyth::util::UNEXPECTED_OVERFLOW;
use starknet::EthAddress;
use super::GovernanceError;

// "Core" (left padded)
const MODULE: u256 = 0x00000000000000000000000000000000000000000000000000000000436f7265;

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub enum Action {
    ContractUpgrade,
    GuardianSetUpgrade,
    SetMessageFee,
    TransferFees,
    RecoverChainId,
}

impl U8TryIntoAction of TryInto<u8, Action> {
    fn try_into(self: u8) -> Option<Action> {
        let value = match self {
            0 => { return Option::None; },
            1 => Action::ContractUpgrade,
            2 => Action::GuardianSetUpgrade,
            3 => Action::SetMessageFee,
            4 => Action::TransferFees,
            5 => Action::RecoverChainId,
            _ => { return Option::None; },
        };
        Option::Some(value)
    }
}

/// Parsed header of a governance message.
#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
pub struct Header {
    /// The destination module of this instruction.
    pub module: u256,
    /// Type of action.
    pub action: Action,
    /// The destination chain ID of this instruction,
    /// or 0 if it's applicable to all chains.
    pub chain_id: u16,
}

/// Payload of `GuardianSetUpgrade` instruction.
#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct NewGuardianSet {
    /// Index of the new set.
    pub set_index: u32,
    /// Public keys of guardians, in order.
    pub keys: Array<EthAddress>,
}

/// Parses the header of a governance instruction and verifies the module.
/// `GovernanceError` enumerates possible panic payloads.
pub fn parse_header(ref reader: Reader) -> Header {
    let module = reader.read_u256();
    if module != MODULE {
        panic_with_felt252(GovernanceError::InvalidModule.into());
    }

    let action = reader.read_u8().try_into().expect(GovernanceError::InvalidAction.into());
    let chain_id = reader.read_u16();
    Header { module, action, chain_id }
}

/// Parses the payload of `GuardianSetUpgrade` instruction.
/// `GovernanceError` enumerates possible panic payloads.
pub fn parse_new_guardian_set(ref reader: Reader) -> NewGuardianSet {
    let set_index = reader.read_u32();
    let num_guardians = reader.read_u8();
    let mut i = 0;
    let mut keys = array![];
    while i < num_guardians {
        let key = reader.read_u160();
        keys.append(key.try_into().expect(UNEXPECTED_OVERFLOW));
        i += 1;
    }
    assert(reader.len() == 0, GovernanceError::TrailingData.into());
    NewGuardianSet { set_index, keys }
}
