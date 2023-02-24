use cosmwasm_std::{Addr, CosmosMsg};
use pyth_wormhole_attester_sdk::PriceAttestation;

use {
    cosmwasm_schema::cw_serde,
    cosmwasm_std::Coin,
    crate::state::PythDataSource,
    serde::{
        Deserialize,
        Serialize,
        Serializer,
    },
};

// cw_serde attribute is equivalent to
// #[derive(Serialize, Deserialize, PartialEq, Debug, Clone, JsonSchema)]
// #[serde(rename_all = "snake_case")]

type HumanAddr = String;

#[cw_serde]
pub struct InstantiateMsg {
    pub wormhole_contract: HumanAddr,
    pub data_sources: Vec<PythDataSource>,

    pub governance_source: PythDataSource,
    pub governance_source_index: u32,
    pub governance_sequence_number: u64,

    pub chain_id: u16,
    pub valid_time_period_secs: u16,

    pub fee: Coin,
}

#[derive(Eq)]
#[cw_serde]
pub struct MigrateMsg {}


// Injective specific

// #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InjectiveMsg {
    RelayPythPrices {
        sender: Addr,
        price_attestations: Vec<PriceAttestation>,
    },
}

// #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct InjectiveMsgWrapper {
    pub route: String,
    pub msg_data: InjectiveMsg,
}


pub fn create_relay_pyth_prices_msg(sender: Addr, price_attestations: Vec<PriceAttestation>) -> CosmosMsg<InjectiveMsgWrapper> {
    InjectiveMsgWrapper {
        route: "oracle".to_string(),
        msg_data: InjectiveMsg::RelayPythPrices { sender, price_attestations },
    }.into()
}


impl From<InjectiveMsgWrapper> for CosmosMsg<InjectiveMsgWrapper> {
    fn from(s: InjectiveMsgWrapper) -> CosmosMsg<InjectiveMsgWrapper> {
        CosmosMsg::Custom(s)
    }
}