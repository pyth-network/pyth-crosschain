use config::{Config as ConfigTrait, ConfigError, Environment, File};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub rpc_url: String,
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
