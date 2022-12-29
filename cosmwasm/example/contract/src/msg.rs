use {
    cosmwasm_std::Addr,
    pyth_sdk_cw::PriceIdentifier,
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
    pub pyth_contract:   Addr,
    pub price_feed_id:   PriceIdentifier,
    pub price_in_usd:    u32,
    pub target_exponent: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    Buy { quantity: u32 },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct MigrateMsg {}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetPrice { quantity: u32 },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct GetPriceResponse {
    pub price:    i64,
    pub exponent: i32,
}
