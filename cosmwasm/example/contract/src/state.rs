use {
    cosmwasm_std::{
        Addr,
        Storage,
    },
    cosmwasm_storage::{
        singleton,
        singleton_read,
        ReadonlySingleton,
        Singleton,
    },
    pyth_sdk_cw::PriceIdentifier,
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
};

pub static CONFIG_KEY: &[u8] = b"config";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ConfigInfo {
    pub pyth_contract:   Addr,
    pub price_feed_id:   PriceIdentifier,
    pub price_in_usd:    u32,
    pub target_exponent: i32,
}

pub fn config(storage: &mut dyn Storage) -> Singleton<ConfigInfo> {
    singleton(storage, CONFIG_KEY)
}

pub fn config_read(storage: &dyn Storage) -> ReadonlySingleton<ConfigInfo> {
    singleton_read(storage, CONFIG_KEY)
}
