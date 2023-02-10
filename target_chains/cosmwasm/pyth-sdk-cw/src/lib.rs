pub mod error;
pub use pyth_sdk::{
    Price,
    PriceFeed,
    PriceIdentifier,
};
use {
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

#[derive(Eq)]
#[cw_serde]
pub enum ExecuteMsg {
    UpdatePriceFeeds { data: Vec<Binary> },
    ExecuteGovernanceInstruction { data: Binary },
}

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
