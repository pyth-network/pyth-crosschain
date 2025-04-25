use {
    crate::{
        chain::ethereum::{EntropyStructsRequest, PythContract},
        config::{Config, EthereumConfig, InspectOptions},
    },
    anyhow::Result,
    ethers::{
        contract::Multicall,
        middleware::Middleware,
        prelude::{Http, Provider},
    },
};

pub async fn inspect(opts: &InspectOptions) -> Result<()> {
    match opts.chain_id.clone() {
        Some(chain_id) => {
            let chain_config = &Config::load(&opts.config.config)?.get_chain_config(&chain_id)?;
            inspect_chain(chain_config, opts.num_requests, opts.multicall_batch_size).await?;
        }
        None => {
            let config = Config::load(&opts.config.config)?;
            for (chain_id, chain_config) in config.chains.iter() {
                println!("Inspecting chain: {}", chain_id);
                inspect_chain(chain_config, opts.num_requests, opts.multicall_batch_size).await?;
            }
        }
    }
    Ok(())
}

async fn inspect_chain(
    chain_config: &EthereumConfig,
    num_requests: u64,
    multicall_batch_size: u64,
) -> Result<()> {
    let rpc_provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;
    let multicall_exists = rpc_provider
        .get_code(ethers::contract::MULTICALL_ADDRESS, None)
        .await
        .expect("Failed to get code")
        .len()
        > 0;

    let contract = PythContract::from_config(chain_config)?;
    let entropy_provider = contract.get_default_provider().call().await?;
    let provider_info = contract.get_provider_info(entropy_provider).call().await?;
    let mut current_request_number = provider_info.sequence_number;
    println!("Initial request number: {}", current_request_number);
    let last_request_number = current_request_number.saturating_sub(num_requests);
    if multicall_exists {
        println!("Using multicall");
        let mut multicall = Multicall::new(
            rpc_provider.clone(),
            Some(ethers::contract::MULTICALL_ADDRESS),
        )
        .await?;
        while current_request_number > last_request_number {
            multicall.clear_calls();
            for _ in 0..multicall_batch_size {
                if current_request_number == 0 {
                    break;
                }
                multicall.add_call(
                    contract.get_request(entropy_provider, current_request_number),
                    false,
                );
                current_request_number -= 1;
            }
            let return_data: Vec<EntropyStructsRequest> = multicall.call_array().await?;
            for request in return_data {
                process_request(rpc_provider.clone(), request).await?;
            }
            println!("Current request number: {}", current_request_number);
        }
    } else {
        println!("Multicall not deployed in this chain, fetching requests one by one");
        while current_request_number > last_request_number {
            let request = contract
                .get_request(entropy_provider, current_request_number)
                .call()
                .await?;
            process_request(rpc_provider.clone(), request).await?;
            current_request_number -= 1;
            if current_request_number % 100 == 0 {
                println!("Current request number: {}", current_request_number);
            }
        }
    }
    Ok(())
}

async fn process_request(
    rpc_provider: Provider<Http>,
    request: EntropyStructsRequest,
) -> Result<()> {
    if request.sequence_number != 0 && request.is_request_with_callback {
        let block = rpc_provider
            .get_block(request.block_number)
            .await?
            .expect("Block not found");
        let datetime = chrono::DateTime::from_timestamp(block.timestamp.as_u64() as i64, 0)
            .expect("Invalid timestamp");
        println!(
            "{} sequence_number:{} block_number:{} requester:{}",
            datetime, request.sequence_number, request.block_number, request.requester
        );
    }
    Ok(())
}
