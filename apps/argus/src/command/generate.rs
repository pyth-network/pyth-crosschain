use {
    crate::{
        api::GetRandomValueResponse,
        chain::ethereum::SignablePythContract,
        config::{Config, GenerateOptions},
    },
    anyhow::Result,
    base64::{engine::general_purpose::STANDARD as base64_standard_engine, Engine as _},
    std::sync::Arc,
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

    // Request a random number on the contract
    let sequence_number = contract
        .request_wrapper(&provider, &user_randomness, opts.blockhash)
        .await?;

    tracing::info!(sequence_number = sequence_number, "random number requested",);

    // Get the committed value from the provider
    let resp = reqwest::get(opts.url.join(&format!(
        "/v1/chains/{}/revelations/{}",
        opts.chain_id, sequence_number
    ))?)
    .await?
    .json::<GetRandomValueResponse>()
    .await?;

    tracing::info!(
        response = base64_standard_engine.encode(resp.value.data()),
        "Retrieved the provider's random value.",
    );
    let provider_randomness = resp.value.data();

    // Submit the provider's and our values to the contract to reveal the random number.
    let random_value = contract
        .reveal_wrapper(
            &provider,
            sequence_number,
            &user_randomness,
            provider_randomness,
        )
        .await?;

    tracing::info!(
        number = base64_standard_engine.encode(random_value),
        "Random number generated."
    );

    Ok(())
}
