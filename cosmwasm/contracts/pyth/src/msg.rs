use {
    crate::state::PythDataSource,
    cosmwasm_std::{
        Binary,
        Uint128,
    },
    pyth_sdk_cw::{
        PriceFeed,
        PriceIdentifier,
    },
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
};

type HumanAddr = String;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct InstantiateMsg {
    pub wormhole_contract:          HumanAddr,
    // TODO: this should support multiple emitters
    pub pyth_emitter:               Binary,
    pub pyth_emitter_chain:         u16,
    pub governance_emitter:         Binary,
    pub governance_emitter_chain:   u16,
    pub governance_source_index:    u32,
    pub governance_sequence_number: u64,
    pub chain_id:                   u16,
    pub valid_time_period_secs:     u16,

    pub fee:       Uint128,
    pub fee_denom: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    // TODO: add UpdatePriceFeeds if necessary
    UpdatePriceFeeds { data: Binary },
    AddDataSource { data_source: PythDataSource },
    RemoveDataSource { data_source: PythDataSource },
    ExecuteGovernanceInstruction { data: Binary },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct MigrateMsg {}


#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    PriceFeed { id: PriceIdentifier },
    GetUpdateFee { vaas: Vec<Binary> },
    GetValidTimePeriod,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct PriceFeedResponse {
    pub price_feed: PriceFeed,
}
