use {
    crate::state::PythDataSource,
    cosmwasm_std::{
        Binary,
        Coin,
    },
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
};

type HumanAddr = String;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct InstantiateMsg {
    pub wormhole_contract: HumanAddr,
    pub data_sources:      Vec<PythDataSource>,

    pub governance_source:          PythDataSource,
    pub governance_source_index:    u32,
    pub governance_sequence_number: u64,

    pub chain_id:               u16,
    pub valid_time_period_secs: u16,

    pub fee: Coin,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    // TODO: add UpdatePriceFeeds if necessary
    UpdatePriceFeeds { data: Vec<Binary> },
    ExecuteGovernanceInstruction { data: Binary },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct MigrateMsg {}

pub use pyth_sdk_cw::{
    PriceFeedResponse,
    QueryMsg,
};
