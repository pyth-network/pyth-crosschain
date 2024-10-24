use alloy::primitives::Address;
use serde::Deserialize;
use std::fs;
use std::path::Path;
use toml;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub rpc_url: String,
    pub contract_address: Address,
    pub hermes_url: String,
}

impl Config {
    pub fn new(config_path: Option<&str>) -> Result<Self, Box<dyn std::error::Error>> {
        let path = config_path.unwrap_or("config/default.toml");
        let config_str = fs::read_to_string(Path::new(path))?;
        let config: Config = toml::from_str(&config_str)?;
        Ok(config)
    }
}
