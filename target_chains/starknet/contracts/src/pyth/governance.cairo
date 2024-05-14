use pyth::reader::{Reader, ReaderImpl};
use pyth::byte_array::ByteArray;
use pyth::pyth::errors::GovernanceActionError;
use core::panic_with_felt252;

const MAGIC: u32 = 0x5054474d;
const MODULE_TARGET: u8 = 1;

#[derive(Drop, Debug)]
pub enum GovernanceAction {
    UpgradeContract,
    AuthorizeGovernanceDataSourceTransfer,
    SetDataSources,
    SetFee,
    SetValidPeriod,
    RequestGovernanceDataSourceTransfer,
    SetWormholeAddress,
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
            _ => { return Option::None; }
        };
        Option::Some(v)
    }
}

#[derive(Drop, Debug)]
pub struct GovernanceInstruction {
    pub target_chain_id: u16,
    pub payload: GovernancePayload,
}

#[derive(Drop, Debug)]
pub enum GovernancePayload {
    SetFee: SetFee,
// TODO: others
}

#[derive(Drop, Debug)]
pub struct SetFee {
    pub value: u64,
    pub expo: u64,
}

pub fn parse_instruction(payload: ByteArray) -> GovernanceInstruction {
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
        GovernanceAction::UpgradeContract => { panic_with_felt252('unimplemented') },
        GovernanceAction::AuthorizeGovernanceDataSourceTransfer => {
            panic_with_felt252('unimplemented')
        },
        GovernanceAction::SetDataSources => { panic_with_felt252('unimplemented') },
        GovernanceAction::SetFee => {
            let value = reader.read_u64();
            let expo = reader.read_u64();
            GovernancePayload::SetFee(SetFee { value, expo })
        },
        GovernanceAction::SetValidPeriod => { panic_with_felt252('unimplemented') },
        GovernanceAction::RequestGovernanceDataSourceTransfer => {
            panic_with_felt252('unimplemented')
        },
        GovernanceAction::SetWormholeAddress => { panic_with_felt252('unimplemented') },
    };

    if reader.len() != 0 {
        panic_with_felt252(GovernanceActionError::InvalidGovernanceMessage.into());
    }
    GovernanceInstruction { target_chain_id, payload, }
}
