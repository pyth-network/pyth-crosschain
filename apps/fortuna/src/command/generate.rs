use {
    crate::{
        chain::ethereum::{RevealedWithCallbackFilter, SignablePythContract},
        config::{Config, GenerateOptions},
    },
    anyhow::Result,
    base64::{engine::general_purpose::STANDARD as base64_standard_engine, Engine as _},
    ethers::providers::Middleware,
    std::sync::Arc,
    tokio::time::{self, Duration},
};

/// Run the entire random number generation protocol to produce a random number.
pub async fn generate(opts: &GenerateOptions) -> Result<()> {
    let contract = Arc::new(
        SignablePythContract::from_config(
            &Config::load(&opts.config.config)?.get_chain_config(&opts.chain_id)?,
            &opts.private_key,
        )
        .await?,
    );

    let user_randomness = rand::random::<[u8; 32]>();
    let provider = opts.provider;

    let mut last_block_number = contract.provider().get_block_number().await?;
    tracing::info!(block_number = last_block_number.as_u64(), "block number");

    tracing::info!("Requesting random number...");

    // Request a random number on the contract
    let sequence_number = contract
        .request_with_callback_wrapper(&provider, &user_randomness)
        .await?;

    tracing::info!(sequence_number = sequence_number, "Random number requested",);

    let mut num_retries = 0;
    let mut found_request = false;
    while !found_request && num_retries < 10 {
        let current_block_number = contract.provider().get_block_number().await?;
        tracing::info!(
            start_block = last_block_number.as_u64(),
            end_block = current_block_number.as_u64(),
            "Checking events between blocks."
        );

        let mut event = contract.revealed_with_callback_filter();
        event.filter = event
            .filter
            .address(contract.address())
            .from_block(last_block_number)
            .to_block(current_block_number);

        let res: Vec<RevealedWithCallbackFilter> = event.query().await?;

        for r in res.iter() {
            if r.request.sequence_number == sequence_number && r.request.provider == provider {
                tracing::info!(
                    number = base64_standard_engine.encode(r.random_number),
                    "Random number generated."
                );
                found_request = true;
            }
        }

        last_block_number = current_block_number;
        num_retries += 1;
        time::sleep(Duration::from_secs(1)).await;
    }

    if !found_request {
        tracing::info!("Failed to receive a callback with the random number.");
    }

    Ok(())
}
