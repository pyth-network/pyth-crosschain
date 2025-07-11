use alloy_primitives::Address;
use ethers::abi::FixedBytes;
use structs::DataSource;

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
    UpgradeContract,
    AuthorizeGovernanceDataSourceTransfer,
    SetDataSources,
    SetFee,
    RequestGovernanceDataSourceTransfer,
    SetWormholeAddress,
    SetFeeInToken,
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
    pub address: Address,
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
    pub claim_vaa: FixedBytes<32>,
}

// #[derive(Drop, Clone, Debug, PartialEq, Serde)]
// pub struct UpgradeContract {
//     // Class hash of the new contract class. The contract class must already be deployed on the
//     // network (e.g. with `starkli declare`). Class hash is a Poseidon hash of all properties
//     // of the contract code, including entry points, ABI, and bytecode,
//     // so specifying a hash securely identifies the new implementation.
//     pub new_implementation: ClassHash,
// }

pub fn parse_instruction(payload: Vec<u8>) -> GovernanceInstruction {

}