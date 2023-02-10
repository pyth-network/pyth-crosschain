use {
    std::time::Duration,
    cosmwasm_schema::{cw_serde, QueryResponses},
    cosmwasm_std::{Binary, Coin},
};

pub use pyth_sdk::{
    PriceIdentifier,
    PriceFeed,
};


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