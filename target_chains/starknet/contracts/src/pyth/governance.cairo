use core::array::ArrayTrait;
use core::panic_with_felt252;
use pyth::byte_buffer::ByteBuffer;
use pyth::pyth::errors::GovernanceActionError;
use pyth::reader::{ReaderImpl, ReaderTrait};
use starknet::{ClassHash, ContractAddress};
use super::DataSource;

const MAGIC: u32 = 0x5054474d;
const MODULE_TARGET: u8 = 1;

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
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

impl U8TryIntoGovernanceAction of TryInto<u8, GovernanceAction> {
    fn try_into(self: u8) -> Option<GovernanceAction> {
        let v = match self {
            0 => GovernanceAction::UpgradeContract,
            1 => GovernanceAction::AuthorizeGovernanceDataSourceTransfer,
            2 => GovernanceAction::SetDataSources,
            3 => GovernanceAction::SetFee,
            4 => GovernanceAction::SetValidPeriod,
            5 => GovernanceAction::RequestGovernanceDataSourceTransfer,
            6 => GovernanceAction::SetWormholeAddress,
            7 => GovernanceAction::SetFeeInToken,
            _ => { return Option::None; },
        };
        Option::Some(v)
    }
}

#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct GovernanceInstruction {
    pub target_chain_id: u16,
    pub payload: GovernancePayload,
}

#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub enum GovernancePayload {
    UpgradeContract: UpgradeContract,
    AuthorizeGovernanceDataSourceTransfer: AuthorizeGovernanceDataSourceTransfer,
    SetDataSources: SetDataSources,
    SetFee: SetFee,
    // SetValidPeriod is unsupported
    RequestGovernanceDataSourceTransfer: RequestGovernanceDataSourceTransfer,
    SetWormholeAddress: SetWormholeAddress,
    SetFeeInToken: SetFeeInToken,
}

#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct SetFee {
    pub value: u64,
    pub expo: u64,
}

#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct SetFeeInToken {
    pub value: u64,
    pub expo: u64,
    pub token: ContractAddress,
}

#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct SetDataSources {
    pub sources: Array<DataSource>,
}

#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct SetWormholeAddress {
    pub address: ContractAddress,
}

#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct RequestGovernanceDataSourceTransfer {
    // Index is used to prevent replay attacks
    // So a claimVaa cannot be used twice.
    pub governance_data_source_index: u32,
}

#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct AuthorizeGovernanceDataSourceTransfer {
    // Transfer governance control over this contract to another data source.
    // The claim_vaa field is a VAA created by the new data source; using a VAA prevents mistakes
    // in the handoff by ensuring that the new data source can send VAAs (i.e., is not an invalid
    // address).
    pub claim_vaa: ByteBuffer,
}

#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct UpgradeContract {
    // Class hash of the new contract class. The contract class must already be deployed on the
    // network (e.g. with `starkli declare`). Class hash is a Poseidon hash of all properties
    // of the contract code, including entry points, ABI, and bytecode,
    // so specifying a hash securely identifies the new implementation.
    pub new_implementation: ClassHash,
}

pub fn parse_instruction(payload: ByteBuffer) -> GovernanceInstruction {
    let mut reader = ReaderImpl::new(payload);
    let magic = reader.read_u32();
    if magic != MAGIC {
        panic_with_felt252(GovernanceActionError::InvalidGovernanceMessage.into());
    }
    let module = reader.read_u8();
    if module != MODULE_TARGET {
        panic_with_felt252(GovernanceActionError::InvalidGovernanceTarget.into());
    }
    let action: GovernanceAction = reader
        .read_u8()
        .try_into()
        .expect(GovernanceActionError::InvalidGovernanceMessage.into());

    let target_chain_id = reader.read_u16();

    let payload = match action {
        GovernanceAction::UpgradeContract => {
            let new_implementation: felt252 = reader
                .read_u256()
                .try_into()
                .expect(GovernanceActionError::InvalidGovernanceMessage.into());
            if new_implementation == 0 {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceMessage.into());
            }
            let new_implementation = new_implementation
                .try_into()
                .expect(GovernanceActionError::InvalidGovernanceMessage.into());
            GovernancePayload::UpgradeContract(UpgradeContract { new_implementation })
        },
        GovernanceAction::AuthorizeGovernanceDataSourceTransfer => {
            let len = reader.len();
            let claim_vaa = reader.read_byte_array(len);
            GovernancePayload::AuthorizeGovernanceDataSourceTransfer(
                AuthorizeGovernanceDataSourceTransfer { claim_vaa },
            )
        },
        GovernanceAction::RequestGovernanceDataSourceTransfer => {
            let governance_data_source_index = reader.read_u32();
            GovernancePayload::RequestGovernanceDataSourceTransfer(
                RequestGovernanceDataSourceTransfer { governance_data_source_index },
            )
        },
        GovernanceAction::SetDataSources => {
            let num_sources = reader.read_u8();
            let mut i = 0;
            let mut sources = array![];
            while i < num_sources {
                let emitter_chain_id = reader.read_u16();
                let emitter_address = reader.read_u256();
                sources.append(DataSource { emitter_chain_id, emitter_address });
                i += 1;
            }
            GovernancePayload::SetDataSources(SetDataSources { sources })
        },
        GovernanceAction::SetFee => {
            let value = reader.read_u64();
            let expo = reader.read_u64();
            GovernancePayload::SetFee(SetFee { value, expo })
        },
        GovernanceAction::SetFeeInToken => {
            let value = reader.read_u64();
            let expo = reader.read_u64();
            let token_len = reader.read_u8();
            if token_len != 32 {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceMessage.into());
            }
            let token: felt252 = reader
                .read_u256()
                .try_into()
                .expect(GovernanceActionError::InvalidGovernanceMessage.into());
            let token = token
                .try_into()
                .expect(GovernanceActionError::InvalidGovernanceMessage.into());
            GovernancePayload::SetFeeInToken(SetFeeInToken { value, expo, token })
        },
        GovernanceAction::SetValidPeriod => { panic_with_felt252('unimplemented') },
        GovernanceAction::SetWormholeAddress => {
            let address: felt252 = reader
                .read_u256()
                .try_into()
                .expect(GovernanceActionError::InvalidGovernanceMessage.into());
            let address = address
                .try_into()
                .expect(GovernanceActionError::InvalidGovernanceMessage.into());
            GovernancePayload::SetWormholeAddress(SetWormholeAddress { address })
        },
    };

    if reader.len() != 0 {
        panic_with_felt252(GovernanceActionError::InvalidGovernanceMessage.into());
    }
    GovernanceInstruction { target_chain_id, payload }
}
