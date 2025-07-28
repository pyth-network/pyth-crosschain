use {
    crate::api::{ApiBlockChainState, ApiState, RestError},
    axum::{extract::State, Json},
    serde::Serialize,
};

#[derive(Serialize, serde::Deserialize)]
pub struct ChainConfigSummary {
    pub name: String,
    pub network_id: u64,
    pub contract_addr: String,
    pub reveal_delay_blocks: u64,
    pub gas_limit: u32,
    pub default_fee: u128,
}

pub async fn get_chain_configs(
    State(state): State<ApiState>,
) -> Result<Json<Vec<ChainConfigSummary>>, RestError> {
    let mut configs = Vec::new();
    for (name, chain) in state.config.chains.iter() {
        let network_id = match state.chains.read().await.get(name) {
            Some(ApiBlockChainState::Initialized(blockchain_state)) => blockchain_state.network_id,
            _ => 0,
        };
        configs.push(ChainConfigSummary {
            name: name.clone(),
            network_id,
            contract_addr: format!("0x{:x}", chain.contract_addr),
            reveal_delay_blocks: chain.reveal_delay_blocks,
            gas_limit: chain.gas_limit,
            default_fee: chain.fee,
        });
    }
    Ok(Json(configs))
}
