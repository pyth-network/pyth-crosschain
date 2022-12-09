use {
    crate::state::PythDataSource,
    cosmwasm_std::Binary,
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
    std::time::Duration,
};

type HumanAddr = String;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct InstantiateMsg {
    pub wormhole_contract:          HumanAddr,
    pub pyth_emitter:               Binary,
    pub pyth_emitter_chain:         u16,
    pub governance_emitter:         Binary,
    pub governance_emitter_chain:   u16,
    pub governance_sequence_number: u64,
    pub chain_id:                   u16,
    pub valid_time_period:          Duration,

    // TODO: fix the type
    pub fee: u128,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    UpdatePriceFeeds { data: Binary },
    AddDataSource { data_source: PythDataSource },
    RemoveDataSource { data_source: PythDataSource },
    ExecuteGovernanceInstruction { data: Binary },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct MigrateMsg {}

pub use pyth_sdk_cw::{
    PriceFeedResponse,
    QueryMsg,
};
