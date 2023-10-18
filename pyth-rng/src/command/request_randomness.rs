use {
    crate::{
        config::RequestRandomnessOptions,
        ethereum::SignablePythContract,
    },
    std::{
        error::Error,
        sync::Arc,
    },
};

pub async fn request_randomness(opts: &RequestRandomnessOptions) -> Result<(), Box<dyn Error>> {
    let contract = Arc::new(
        SignablePythContract::from_config(
            &opts.config.load()?.get_chain_config(&opts.chain_id)?,
            &opts.private_key,
        )
        .await?,
    );

    let user_randomness = rand::random::<[u8; 32]>();
    let sequence_number = contract
        .request_wrapper(&opts.provider, &user_randomness, false)
        .await?;

    println!("sequence number: {:#?}", sequence_number);

    Ok(())
}
