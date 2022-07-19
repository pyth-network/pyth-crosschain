use std::time::Duration;

use pyth_sdk::PriceFeed;
use schemars::JsonSchema;
use serde::{
    Deserialize,
    Serialize,
};

use cosmwasm_std::{
    Storage,
    Timestamp,
};

use cosmwasm_storage::{
    bucket,
    bucket_read,
    singleton,
    singleton_read,
    Bucket,
    ReadonlyBucket,
    ReadonlySingleton,
    Singleton,
};

type HumanAddr = String;

pub static CONFIG_KEY: &[u8] = b"config";
pub static PRICE_INFO_KEY: &[u8] = b"price_info_v3";

/// Maximum acceptable time period before price is considered to be stale.
///
/// This value considers attestation delay which currently might up to a minute.
pub const VALID_TIME_PERIOD: Duration = Duration::from_secs(3 * 60);

// Guardian set information
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, JsonSchema)]
pub struct ConfigInfo {
    pub wormhole_contract:  HumanAddr,
    pub pyth_emitter:       Vec<u8>,
    pub pyth_emitter_chain: u16,
}


#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, JsonSchema)]
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
