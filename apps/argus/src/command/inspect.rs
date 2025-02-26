use {
    crate::{
        chain::ethereum::{PythContract, Request},
        config::{Config, EthereumConfig, InspectOptions},
    },
    anyhow::Result,
    ethers::{
        contract::Multicall,
        middleware::Middleware,
        prelude::{Http, Provider},
    },
    std::time::{Duration, SystemTime},
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

    // Get the current sequence number directly from the contract's storage
    let current_sequence_number = contract.get_current_sequence_number().await?;

    // The current sequence number is the next one to be assigned, so subtract 1 to get the latest
    let latest_sequence_number = current_sequence_number.saturating_sub(1);
    let mut current_request_number = latest_sequence_number;

    println!("Latest sequence number: {}", current_request_number);

    if current_request_number == 0 {
        println!("No requests found");
        return Ok(());
    }

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
                multicall.add_call(contract.get_request(current_request_number), false);
                current_request_number -= 1;
            }
            let return_data: Vec<Request> = multicall.call_array().await?;
            for request in return_data {
                process_request(request).await?;
            }
            println!("Current request number: {}", current_request_number);
        }
    } else {
        println!("Multicall not deployed in this chain, fetching requests one by one");
        while current_request_number > last_request_number {
            let request = contract.get_request(current_request_number).call().await?;
            process_request(request).await?;
            current_request_number -= 1;
            if current_request_number % 100 == 0 {
                println!("Current request number: {}", current_request_number);
            }
        }
    }
    Ok(())
}

async fn process_request(request: Request) -> Result<()> {
    if request.sequence_number != 0 {
        // Convert publish_time to a datetime
        let publish_time = request.publish_time.as_u64();
        let datetime = if publish_time > 0 {
            match SystemTime::UNIX_EPOCH.checked_add(Duration::from_secs(publish_time)) {
                Some(time) => format!("{:?}", time),
                None => "Invalid time".to_string(),
            }
        } else {
            "N/A".to_string()
        };

        println!(
            "{} sequence_number:{} publish_time:{} requester:{} price_ids:{}",
            datetime,
            request.sequence_number,
            request.publish_time,
            request.requester,
            request.price_ids.len()
        );
    }
    Ok(())
}
