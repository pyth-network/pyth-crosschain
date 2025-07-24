use crate::{api::{ApiState, RestError}, config::Config};
use axum::{extract::State, Json};

#[derive(serde::Serialize)]
pub struct ChainConfigSummary {
    pub name: String,
    pub contract_addr: String,
    pub reveal_delay_blocks: u64,
    pub gas_limit: u32,
    pub fee: u128,
}

pub async fn get_chain_configs(State(_state): State<ApiState>) -> Result<Json<Vec<ChainConfigSummary>>, RestError> {
    // Try to load the config file (assume default path for now)
    let config = match Config::load("config.yaml") {
        Ok(cfg) => cfg,
        Err(_) => return Err(RestError::Unknown),
    };
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