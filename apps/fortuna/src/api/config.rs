use crate::{api::{ApiState, RestError}, config::Config};
use axum::{extract::State, Json};
use anyhow::{anyhow, Error};

#[derive(serde::Serialize)]
pub struct ChainConfigSummary {
    pub name: String,
    pub contract_addr: String,
    pub reveal_delay_blocks: u64,
    pub gas_limit: u32,
    pub fee: u128,
}

pub async fn get_chain_configs(State(_state): State<ApiState>) -> Result<Json<Vec<ChainConfigSummary>>, Error> {
    // Try to load the config file (assume default path for now)
    let yaml_content = std::fs::read_to_string("../config.yaml").map_err(|e| anyhow!("Failed to read config file: {}", e))?;
    let config: Config = serde_yaml::from_str(&yaml_content).map_err(|e| anyhow!("Failed to parse config file: {}", e))?;
    let mut configs = Vec::new();
    for (name, chain) in config.chains.iter() {
        configs.push(ChainConfigSummary {
            name: name.clone(),
            contract_addr: format!("0x{:x}", chain.contract_addr),
            reveal_delay_blocks: chain.reveal_delay_blocks,
            gas_limit: chain.gas_limit,
            fee: chain.fee,
        });
    }
    Ok(Json(configs))
}