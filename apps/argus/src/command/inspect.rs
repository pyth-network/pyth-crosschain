use {
    crate::{
        config::{Config, ChainConfig},
        contract::{PulseContract, PulseContractImpl},
        error::Result,
    },
    alloy::providers::Provider,
    std::sync::Arc,
};

pub struct InspectOptions {
    pub config: String,
    pub chain_id: Option<String>,
    pub num_requests: u64,
}

pub async fn inspect(opts: &InspectOptions) -> Result<()> {
    match opts.chain_id.clone() {
        Some(chain_id) => {
            let chain_config = &Config::load(&opts.config)?.get_chain_config(&chain_id)?;
            inspect_chain(chain_config, opts.num_requests).await?;
        }
        None => {
            let config = Config::load(&opts.config)?;
            for (chain_id, chain_config) in config.chains.iter() {
                println!("Inspecting chain: {}", chain_id);
                inspect_chain(chain_config, opts.num_requests).await?;
            }
        }
    }
    Ok(())
}

async fn inspect_chain(chain_config: &ChainConfig, num_requests: u64) -> Result<()> {
    let provider = Provider::try_from(&chain_config.geth_rpc_addr)?;
    let contract = Arc::new(PulseContractImpl::new(provider, chain_config.contract_addr));

    let current_sequence = contract.get_current_sequence().await?;
    println!("Current sequence number: {}", current_sequence);

    let last_sequence = current_sequence.saturating_sub(num_requests);
    for seq in last_sequence..current_sequence {
        if let Some(request) = contract.get_request(seq).await? {
            println!(
                "Request {}: publish_time={}, requester={}",
                request.sequence_number, request.publish_time, request.requester
            );
        }
    }

    Ok(())
}
