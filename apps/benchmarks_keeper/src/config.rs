use alloy::primitives::Address;
use config::{Config as ConfigTrait, ConfigError, Environment, File};
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub rpc_url: String,
    pub contract_address: Address,
}

impl Config {
    pub fn new() -> Result<Self, ConfigError> {
        let config = ConfigTrait::builder()
            .add_source(File::with_name("config/default"))
            .add_source(Environment::with_prefix("APP"))
            .build()?;

        config.try_deserialize()
    }
}
