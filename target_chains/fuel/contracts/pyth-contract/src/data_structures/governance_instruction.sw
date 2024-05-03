library;

use ::errors::PythError;
use ::data_structures::{data_source::*, price::*, wormhole_light::{StorageGuardianSet, WormholeVM}};
use pyth_interface::data_structures::{data_source::DataSource, price::{PriceFeed, PriceFeedId}, governance_payload::{UpgradeContractPayload, AuthorizeGovernanceDataSourceTransferPayload, RequestGovernanceDataSourceTransferPayload, SetDataSourcesPayload, SetFeePayload, SetValidPeriodPayload, SetWormholeAddressPayload}, governance_instruction::{GovernanceInstruction, GovernanceModule, GovernanceAction}};
use std::{bytes::Bytes, hash::Hash};
use std::math::*;
use std::primitive_conversions::{u32::*, u64::*};


pub const MAGIC: u32 = 0x5054474d;

impl GovernanceInstruction {
    pub fn new(magic: u32,
                module: GovernanceModule,
                action: GovernanceAction,
                target_chain_id: u16,
                payload: Bytes
                ) -> Self {
        Self { magic, module, action, target_chain_id, payload }
    }

    pub fn parse_governance_instruction(encoded_instruction: Bytes) -> Self {
        let mut index = 0;
        let magic = u32::from_be_bytes([
            encoded_instruction.get(index).unwrap(),
            encoded_instruction.get(index + 1).unwrap(),
            encoded_instruction.get(index + 2).unwrap(),
            encoded_instruction.get(index + 3).unwrap(),
        ]);
        require(magic == MAGIC, PythError::InvalidMagic);
        index += 4;

        let mod_number = encoded_instruction.get(index).unwrap();
        let module = match mod_number {
            0 => GovernanceModule::Executor,
            1 => GovernanceModule::Target,
            2 => GovernanceModule::EvmExecutor,
            3 => GovernanceModule::StacksTarget,
            _ => GovernanceModule::Invalid,
        };
        require(match module {
            GovernanceModule::Target => true,
            _ => false,
        }, PythError::InvalidGovernanceTarget);
        // addtionally skip minor_version(2 bytes) as unused
        index += 1;

        let action_number = encoded_instruction.get(index).unwrap();
        let governance_action = match action_number {
            0 => GovernanceAction::UpgradeContract,
            1 => GovernanceAction::AuthorizeGovernanceDataSourceTransfer,
            2 => GovernanceAction::SetDataSources,
            3 => GovernanceAction::SetFee,
            4 => GovernanceAction::SetValidPeriod,
            5 => GovernanceAction::RequestGovernanceDataSourceTransfer,
            6 => GovernanceAction::SetWormholeAddress,
            _ => GovernanceAction::Invalid,
        };
        require(match governance_action {
            GovernanceAction::Invalid => false,
            _ => true,
        }, PythError::InvalidGovernanceAction);
        index += 1;

        let target_chain_id = u16::from_be_bytes([
            encoded_instruction.get(index).unwrap(),
            encoded_instruction.get(index + 1).unwrap(),
        ]);
        index += 2;

        let (_, payload) = encoded_instruction.split_at(index);

        GovernanceInstruction::new(
            magic,
            module,
            governance_action,
            target_chain_id,
            payload,
        )
    }

    /// Parse a UpgradeContractPayload (action 1) with minimal validation
    pub fn parse_upgrade_contract_payload(encoded_payload: Bytes) -> UpgradeContractPayload {
        let mut index = 0;
        let b256_encoded_payload: b256 = encoded_payload.into();
        index += 20;
        require(index == encoded_payload.len(), PythError::InvalidGovernanceMessage);
        let uc = UpgradeContractPayload {
            new_implementation: Identity::Address(Address::from(b256_encoded_payload)),
        };
        uc
    }

    /// Parse an AuthorizeGovernanceDataSourceTransferPayload (action 2) with minimal validation
    pub fn parse_authorize_governance_data_source_transfer_payload(encoded_payload: Bytes) -> AuthorizeGovernanceDataSourceTransferPayload {
        AuthorizeGovernanceDataSourceTransferPayload {
            claim_vaa: encoded_payload,
        }
    }

    pub fn parse_request_governance_data_source_transfer_payload(encoded_payload: Bytes) -> RequestGovernanceDataSourceTransferPayload {
        let mut index = 0;
        let governance_data_source_index = u32::from_be_bytes([
            encoded_payload.get(index).unwrap(),
            encoded_payload.get(index + 1).unwrap(),
            encoded_payload.get(index + 2).unwrap(),
            encoded_payload.get(index + 3).unwrap(),
        ]);
        index += 4;
        require(index == encoded_payload.len(), PythError::InvalidGovernanceMessage);
        let rdgst = RequestGovernanceDataSourceTransferPayload {
            governance_data_source_index,
        };
        rdgst
    }

    pub fn parse_set_data_sources_payload(encoded_payload: Bytes) -> SetDataSourcesPayload {
        let mut index = 0;
        let data_sources_length = encoded_payload.get(index).unwrap().as_u64();
        index += 1;
        let mut data_sources = Vec::with_capacity(data_sources_length);

        let mut i = 0;
        while i < data_sources_length {
            let (_, slice) = encoded_payload.split_at(index);
            let (slice, _) = slice.split_at(2);
            let chain_id = u16::from_be_bytes([slice.get(0).unwrap(), slice.get(1).unwrap()]);
            index += 2;
            let (_, slice) = encoded_payload.split_at(index);
            let (slice, _) = slice.split_at(32);
            let emitter_address: b256 = slice.into();
            index += 32;

            data_sources.push(DataSource {
                chain_id,
                emitter_address,
            });
            i += 1
        }

        require(index == encoded_payload.len(), PythError::InvalidGovernanceMessage);
        let sds = SetDataSourcesPayload { data_sources };
        sds
    }

    pub fn parse_set_fee_payload(encoded_payload: Bytes) -> SetFeePayload {
        let mut index = 0;
        let val = u64::from_be_bytes([
            encoded_payload.get(index).unwrap(),
            encoded_payload.get(index + 1).unwrap(),
            encoded_payload.get(index + 2).unwrap(),
            encoded_payload.get(index + 3).unwrap(),
            encoded_payload.get(index + 4).unwrap(),
            encoded_payload.get(index + 5).unwrap(),
            encoded_payload.get(index + 6).unwrap(),
            encoded_payload.get(index + 7).unwrap(),
        ]);
        index += 8;
        let expo = u64::from_be_bytes([
            encoded_payload.get(index).unwrap(),
            encoded_payload.get(index + 1).unwrap(),
            encoded_payload.get(index + 2).unwrap(),
            encoded_payload.get(index + 3).unwrap(),
            encoded_payload.get(index + 4).unwrap(),
            encoded_payload.get(index + 5).unwrap(),
            encoded_payload.get(index + 6).unwrap(),
            encoded_payload.get(index + 7).unwrap(),
        ]);
        index += 8;
        require(encoded_payload.len() == index, PythError::InvalidGovernanceMessage);
        let sf = SetFeePayload {
            new_fee: val * 10u64.pow(expo.try_as_u32().unwrap()),
        };
        sf
    }

    pub fn parse_set_valid_period_payload(encoded_payload: Bytes) -> SetValidPeriodPayload {
        let mut index = 0;
        let valid_time_period_seconds = u64::from_be_bytes([
            encoded_payload.get(index).unwrap(),
            encoded_payload.get(index + 1).unwrap(),
            encoded_payload.get(index + 2).unwrap(),
            encoded_payload.get(index + 3).unwrap(),
            encoded_payload.get(index + 4).unwrap(),
            encoded_payload.get(index + 5).unwrap(),
            encoded_payload.get(index + 6).unwrap(),
            encoded_payload.get(index + 7).unwrap(),
        ]);
        index += 8;
        require(index == encoded_payload.len(), PythError::InvalidGovernanceMessage);
        let svp = SetValidPeriodPayload {
            new_valid_period: valid_time_period_seconds,
        };
        svp
    }

    pub fn parse_set_wormhole_address_payload(encoded_payload: Bytes) -> SetWormholeAddressPayload {
        let mut index = 0;
        let (slice, _) = encoded_payload.split_at(32);
        let wormhole_address: b256 = slice.into();
        index += 32;
        require(index == encoded_payload.len(), PythError::InvalidGovernanceMessage);
        let swa = SetWormholeAddressPayload {
            new_wormhole_address: wormhole_address,
        };
        swa
    }
}
