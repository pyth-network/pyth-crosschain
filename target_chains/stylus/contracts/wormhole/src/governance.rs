use stylus_sdk::alloy_primitives::{Address, U256};
use stylus_sdk::prelude::*;
use serde::{Deserialize, Serialize};
use core::hash::Hash;

use crate::WormholeError;

pub const MODULE: U256 = U256::from_be_bytes([
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x43, 0x6f, 0x72, 0x65,
]);

#[derive(Debug, Clone)]
pub enum WormholeGovernanceError {
    InvalidModule,
    InvalidAction,
    TrailingData
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum Action {
    ContractUpgrade = 0,
    GuardianSetUpgrade = 1,
    SetMessageFee = 2,
    TransferFees = 3,
    RecoverChainId = 4,
}

impl TryFrom<u8> for Action {
    type Error = WormholeError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Action::ContractUpgrade),
            2 => Ok(Action::GuardianSetUpgrade),
            3 => Ok(Action::SetMessageFee),
            4 => Ok(Action::TransferFees),
            5 => Ok(Action::RecoverChainId),
            _ => Err(WormholeError::InvalidAction),
        }
    }
}

/// Parsed header of a governance message.
#[derive(Debug, Clone, PartialEq)]
pub struct Header {
    /// The destination module of this instruction.
    pub module: U256,
    /// Type of action.
    pub action: Action,
    /// The destination chain ID of this instruction,
    /// or 0 if it's applicable to all chains.
    pub chain_id: u16,
}

/// Payload of `GuardianSetUpgrade` instruction.
#[derive(Debug, Clone, PartialEq)]
pub struct NewGuardianSet {
    /// Index of the new set.
    pub set_index: u32,
    /// Public keys of guardians, in order.
    pub keys: Vec<Address>,
}

pub struct Governance;

impl Governance {
    /// Parses the header of a governance instruction and verifies the module.
    /// `WormholeGovernanceError` enumerates possible panic payloads.
    pub fn parse_header(data: &[u8], cursor: &mut usize) -> Result<Header, WormholeError> {
        if *cursor + 35 > data.len() {
            return Err(WormholeError::InvalidVMFormat);
        }

        let mut module_bytes = [0u8; 32];
        module_bytes.copy_from_slice(&data[*cursor..*cursor + 32]);
        let module = U256::from_be_bytes(module_bytes);
        *cursor += 32;

        if module != MODULE {
            return Err(WormholeError::InvalidModule);
        }

        let action_byte = data[*cursor];
        *cursor += 1;
        let action = Action::try_from(action_byte)?;

        let chain_id = u16::from_be_bytes([data[*cursor], data[*cursor + 1]]);
        *cursor += 2;

        Ok(Header {
            module,
            action,
            chain_id,
        })
    }

    /// Parses the payload of `GuardianSetUpgrade` instruction.
    /// `WormholeGovernanceError` enumerates possible panic payloads.
    pub fn parse_new_guardian_set(data: &[u8], cursor: &mut usize) -> Result<NewGuardianSet, WormholeError> {
        if *cursor + 5 > data.len() {
            return Err(WormholeError::InvalidVMFormat);
        }

        let set_index = u32::from_be_bytes([
            data[*cursor],
            data[*cursor + 1],
            data[*cursor + 2],
            data[*cursor + 3],
        ]);
        *cursor += 4;

        let num_guardians = data[*cursor];
        *cursor += 1;

        let mut keys = Vec::new();
        for _ in 0..num_guardians {
            if *cursor + 20 > data.len() {
                return Err(WormholeError::InvalidVMFormat);
            }

            let mut addr_bytes = [0u8; 20];
            addr_bytes.copy_from_slice(&data[*cursor..*cursor + 20]);
            let address = Address::from(addr_bytes);
            keys.push(address);
            *cursor += 20;
        }

        if *cursor != data.len() {
            return Err(WormholeError::TrailingData);
        }

        Ok(NewGuardianSet { set_index, keys })
    }
}
