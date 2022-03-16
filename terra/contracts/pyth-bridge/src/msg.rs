use cosmwasm_std::{
    Binary,
    Timestamp
};
use pyth_sdk::{PriceFeed, PriceIdentifier};
use schemars::JsonSchema;
use serde::{
    Deserialize,
    Serialize,
};

type HumanAddr = String;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub wormhole_contract: HumanAddr,
    pub pyth_emitter: Binary,
    pub pyth_emitter_chain: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    SubmitVaa { data: Binary },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct MigrateMsg {}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    /// price_id is currently the price public_key in Solana. It is available in https://pyth.network/markets/
    PriceInfo { price_id: PriceIdentifier },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct PriceInfoResponse {
    /// Pyth Price Feed
    pub price_feed:        PriceFeed,
    /// The timestamp that the price was published to the wormhole
    pub time: Timestamp,
}
