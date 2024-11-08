use {
    crate::{
        chain::ethereum::SignablePythContract,
        config::{Config, RequestRandomnessOptions},
    },
    anyhow::Result,
    std::sync::Arc,
};

pub async fn request_randomness(opts: &RequestRandomnessOptions) -> Result<()> {
    let contract = Arc::new(
        SignablePythContract::from_config(
            &Config::load(&opts.config.config)?.get_chain_config(&opts.chain_id)?,
            &opts.private_key,
        )
        .await?,
    );

    let user_randomness = rand::random::<[u8; 32]>();
    let sequence_number = contract
        .request_wrapper(&opts.provider, &user_randomness, false)
        .await?;

    tracing::info!("sequence number: {:#?}", sequence_number);

    Ok(())
}
