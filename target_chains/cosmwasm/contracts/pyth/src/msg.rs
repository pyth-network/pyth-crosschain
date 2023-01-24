use {
    crate::{
        state::PythDataSource,
        PriceFeed,
        PriceIdentifier,
    },
    cosmwasm_schema::{
        cw_serde,
        QueryResponses,
    },
    cosmwasm_std::{
        Binary,
        Coin,
    },
    std::time::Duration,
};

// cw_serde attribute is equivalent to
// #[derive(Serialize, Deserialize, PartialEq, Debug, Clone, JsonSchema)]
// #[serde(rename_all = "snake_case")]

type HumanAddr = String;

#[cw_serde]
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

#[derive(Eq)]
#[cw_serde]
pub enum ExecuteMsg {
    // TODO: add UpdatePriceFeeds if necessary
    UpdatePriceFeeds { data: Vec<Binary> },
    ExecuteGovernanceInstruction { data: Binary },
}

#[derive(Eq)]
#[cw_serde]
pub struct MigrateMsg {}


#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(PriceFeedResponse)]
    PriceFeed { id: PriceIdentifier },
    #[returns(Coin)]
    GetUpdateFee { vaas: Vec<Binary> },
    #[returns(Duration)]
    GetValidTimePeriod,
}

#[cw_serde]
pub struct PriceFeedResponse {
    pub price_feed: PriceFeed,
}
