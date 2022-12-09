use cosmwasm_std::Coin;
use {
    cosmwasm_std::{
        Addr,
        Binary,
        Storage,
        Timestamp,
    },
    cosmwasm_storage::{
        bucket,
        bucket_read,
        singleton,
        singleton_read,
        Bucket,
        ReadonlyBucket,
        ReadonlySingleton,
        Singleton,
    },
    pyth_sdk_cw::PriceFeed,
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
    std::{
        collections::HashSet,
        time::Duration,
    },
};

pub static CONFIG_KEY: &[u8] = b"config";
pub static PRICE_INFO_KEY: &[u8] = b"price_info_v3";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Hash, JsonSchema)]
pub struct PythDataSource {
    pub emitter:            Binary,
    pub pyth_emitter_chain: u16,
}

// Guardian set information
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct ConfigInfo {
    pub owner:                      Addr,
    pub wormhole_contract:          Addr,
    pub data_sources:               HashSet<PythDataSource>,
    pub governance_source:          PythDataSource,
    pub governance_sequence_number: u64,
    pub chain_id:                   u16,
    pub valid_time_period:          Duration,

    // The fee to pay, denominated in fee_denom (typically, the chain's native token)
    pub fee: u128,
    pub fee_denom: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct PriceInfo {
    pub arrival_time:     Timestamp,
    pub arrival_block:    u64,
    pub attestation_time: Timestamp,
    pub price_feed:       PriceFeed,
}

pub fn config(storage: &mut dyn Storage) -> Singleton<ConfigInfo> {
    singleton(storage, CONFIG_KEY)
}

pub fn config_read(storage: &dyn Storage) -> ReadonlySingleton<ConfigInfo> {
    singleton_read(storage, CONFIG_KEY)
}

pub fn price_info(storage: &mut dyn Storage) -> Bucket<PriceInfo> {
    bucket(storage, PRICE_INFO_KEY)
}

pub fn price_info_read(storage: &dyn Storage) -> ReadonlyBucket<PriceInfo> {
    bucket_read(storage, PRICE_INFO_KEY)
}
