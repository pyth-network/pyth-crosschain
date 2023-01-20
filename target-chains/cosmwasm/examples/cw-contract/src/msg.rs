use cosmwasm_std::Binary;
use pyth_cosmwasm::{
    Price,
    PriceIdentifier,
};
use schemars::JsonSchema;
use serde::{
    Deserialize,
    Serialize,
};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct MigrateMsg {}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub price_feed_id:      PriceIdentifier,
    pub pyth_contract_addr: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    FetchPrice {},
    FetchUpdateFee { vaas: Vec<Binary> },
    FetchValidTimePeriod,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct FetchPriceResponse {
    pub current_price: Price,
    pub ema_price:     Price,
}
