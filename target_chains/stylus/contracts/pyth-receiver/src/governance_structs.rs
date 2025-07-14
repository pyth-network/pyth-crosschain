use crate::error::PythReceiverError;
use crate::structs::DataSource;
use alloc::vec::Vec;
use stylus_sdk::alloy_primitives::{Address, FixedBytes, U16};

const MAGIC: u32 = 0x5054474d;
const MODULE_TARGET: u8 = 1;

#[derive(Clone, Debug, PartialEq)]
pub enum GovernanceAction {
    UpgradeContract,
    AuthorizeGovernanceDataSourceTransfer,
    SetDataSources,
    SetFee,
    SetValidPeriod,
    RequestGovernanceDataSourceTransfer,
    SetWormholeAddress,
    SetFeeInToken,
}

impl TryFrom<u8> for GovernanceAction {
    type Error = PythReceiverError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(GovernanceAction::UpgradeContract),
            1 => Ok(GovernanceAction::AuthorizeGovernanceDataSourceTransfer),
            2 => Ok(GovernanceAction::SetDataSources),
            3 => Ok(GovernanceAction::SetFee),
            4 => Ok(GovernanceAction::SetValidPeriod),
            5 => Ok(GovernanceAction::RequestGovernanceDataSourceTransfer),
            6 => Ok(GovernanceAction::SetWormholeAddress),
            7 => Ok(GovernanceAction::SetFeeInToken),
            _ => Err(PythReceiverError::InvalidGovernanceAction),
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct GovernanceInstruction {
    pub target_chain_id: u16,
    pub payload: GovernancePayload,
}

#[derive(Clone, Debug, PartialEq)]
pub enum GovernancePayload {
    UpgradeContract(UpgradeContract),
    AuthorizeGovernanceDataSourceTransfer(AuthorizeGovernanceDataSourceTransfer),
    SetDataSources(SetDataSources),
    SetFee(SetFee),
    SetValidPeriod(SetValidPeriod),
    RequestGovernanceDataSourceTransfer(RequestGovernanceDataSourceTransfer),
    SetWormholeAddress(SetWormholeAddress),
    SetFeeInToken(SetFeeInToken),
    SetTransactionFee(SetTransactionFee),
    WithdrawFee(WithdrawFee),
}

#[derive(Clone, Debug, PartialEq)]
pub struct SetFee {
    pub value: u64,
    pub expo: u64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SetValidPeriod {
    pub valid_time_period_seconds: u64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SetTransactionFee {
    pub value: u64,
    pub expo: u64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct WithdrawFee {
    pub value: u64,
    pub expo: u64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SetFeeInToken {
    pub value: u64,
    pub expo: u64,
    pub token: Address,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SetDataSources {
    pub sources: Vec<DataSource>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SetWormholeAddress {
    pub address: Address,
}

#[derive(Clone, Debug, PartialEq)]
pub struct RequestGovernanceDataSourceTransfer {
    pub governance_data_source_index: u32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AuthorizeGovernanceDataSourceTransfer {
    pub claim_vaa: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct UpgradeContract {
    pub new_implementation: FixedBytes<32>,
}

pub fn parse_instruction(payload: Vec<u8>) -> Result<GovernanceInstruction, PythReceiverError> {
    if payload.len() < 8 {
        return Err(PythReceiverError::InvalidGovernanceMessage);
    }

    let mut cursor = 0;

    let magic_bytes = payload
        .get(cursor..cursor + 4)
        .ok_or(PythReceiverError::InvalidGovernanceMessage)?;

    let magic = u32::from_be_bytes(
        magic_bytes
            .try_into()
            .map_err(|_| PythReceiverError::InvalidGovernanceMessage)?,
    );

    cursor += 4;

    if magic != MAGIC {
        return Err(PythReceiverError::InvalidGovernanceMessage);
    }

    let module = payload[cursor];
    cursor += 1;

    if module != MODULE_TARGET {
        return Err(PythReceiverError::InvalidGovernanceTarget);
    }

    let action = GovernanceAction::try_from(payload[cursor])?;
    cursor += 1;

    let target_chain_id = u16::from_be_bytes([payload[cursor], payload[cursor + 1]]);
    cursor += 2;

    let governance_payload = match action {
        GovernanceAction::UpgradeContract => {
            if payload.len() < cursor + 32 {
                return Err(PythReceiverError::InvalidGovernanceMessage);
            }
            let mut new_implementation = [0u8; 32];
            new_implementation.copy_from_slice(&payload[cursor..cursor + 32]);
            cursor += 32;
            GovernancePayload::UpgradeContract(UpgradeContract {
                new_implementation: FixedBytes::from(new_implementation),
            })
        }
        GovernanceAction::AuthorizeGovernanceDataSourceTransfer => {
            let claim_vaa = payload[cursor..].to_vec();
            GovernancePayload::AuthorizeGovernanceDataSourceTransfer(
                AuthorizeGovernanceDataSourceTransfer { claim_vaa },
            )
        }
        GovernanceAction::RequestGovernanceDataSourceTransfer => {
            if payload.len() < cursor + 4 {
                return Err(PythReceiverError::InvalidGovernanceMessage);
            }
            let governance_data_source_bytes = payload
                .get(cursor..cursor + 4)
                .ok_or(PythReceiverError::InvalidGovernanceMessage)?;

            let governance_data_source_index = u32::from_be_bytes(
                governance_data_source_bytes
                    .try_into()
                    .map_err(|_| PythReceiverError::InvalidGovernanceMessage)?,
            );

            cursor += 4;
            GovernancePayload::RequestGovernanceDataSourceTransfer(
                RequestGovernanceDataSourceTransfer {
                    governance_data_source_index,
                },
            )
        }
        GovernanceAction::SetDataSources => {
            if payload.len() < cursor + 1 {
                return Err(PythReceiverError::InvalidGovernanceMessage);
            }
            let num_sources = payload[cursor];
            cursor += 1;

            let mut sources = Vec::new();
            for _ in 0..num_sources {
                if payload.len() < cursor + 34 {
                    return Err(PythReceiverError::InvalidGovernanceMessage);
                }
                let emitter_chain_id = u16::from_be_bytes([payload[cursor], payload[cursor + 1]]);
                cursor += 2;

                let mut emitter_address = [0u8; 32];
                emitter_address.copy_from_slice(&payload[cursor..cursor + 32]);
                cursor += 32;

                sources.push(DataSource {
                    chain_id: U16::from(emitter_chain_id),
                    emitter_address: FixedBytes::from(emitter_address),
                });
            }
            GovernancePayload::SetDataSources(SetDataSources { sources })
        }
        GovernanceAction::SetFee => {
            if payload.len() < cursor + 16 {
                return Err(PythReceiverError::InvalidGovernanceMessage);
            }
            let fee_value_bytes = payload
                .get(cursor..cursor + 8)
                .ok_or(PythReceiverError::InvalidGovernanceMessage)?;

            let value = u64::from_be_bytes(
                fee_value_bytes
                    .try_into()
                    .map_err(|_| PythReceiverError::InvalidGovernanceMessage)?,
            );

            cursor += 8;

            let expo_bytes = payload
                .get(cursor..cursor + 8)
                .ok_or(PythReceiverError::InvalidGovernanceMessage)?;
            let expo = u64::from_be_bytes(
                expo_bytes
                    .try_into()
                    .map_err(|_| PythReceiverError::InvalidGovernanceMessage)?,
            );

            cursor += 8;
            GovernancePayload::SetFee(SetFee { value, expo })
        }
        GovernanceAction::SetFeeInToken => {
            if payload.len() < cursor + 17 {
                return Err(PythReceiverError::InvalidGovernanceMessage);
            }

            let fee_token_value = payload
                .get(cursor..cursor + 8)
                .ok_or(PythReceiverError::InvalidGovernanceMessage)?;

            let value = u64::from_be_bytes(
                fee_token_value
                    .try_into()
                    .map_err(|_| PythReceiverError::InvalidGovernanceMessage)?,
            );
            cursor += 8;

            let expo_bytes = payload
                .get(cursor..cursor + 8)
                .ok_or(PythReceiverError::InvalidGovernanceMessage)?;
            let expo = u64::from_be_bytes(
                expo_bytes
                    .try_into()
                    .map_err(|_| PythReceiverError::InvalidGovernanceMessage)?,
            );
            cursor += 8;

            let token_len = payload[cursor];
            cursor += 1;

            if token_len != 20 {
                return Err(PythReceiverError::InvalidGovernanceMessage);
            }
            if payload.len() < cursor + 20 {
                return Err(PythReceiverError::InvalidGovernanceMessage);
            }
            let mut token_bytes = [0u8; 20];
            token_bytes.copy_from_slice(&payload[cursor..cursor + 20]);
            cursor += 20;
            GovernancePayload::SetFeeInToken(SetFeeInToken {
                value,
                expo,
                token: Address::from(token_bytes),
            })
        }
        GovernanceAction::SetValidPeriod => {
            return Err(PythReceiverError::InvalidGovernanceMessage);
        }
        GovernanceAction::SetWormholeAddress => {
            if payload.len() < cursor + 20 {
                return Err(PythReceiverError::InvalidGovernanceMessage);
            }
            let mut address_bytes = [0u8; 20];
            address_bytes.copy_from_slice(&payload[cursor..cursor + 20]);
            cursor += 20;
            GovernancePayload::SetWormholeAddress(SetWormholeAddress {
                address: Address::from(address_bytes),
            })
        }
    };

    if cursor != payload.len() {
        return Err(PythReceiverError::InvalidGovernanceMessage);
    }

    Ok(GovernanceInstruction {
        target_chain_id,
        payload: governance_payload,
    })
}
