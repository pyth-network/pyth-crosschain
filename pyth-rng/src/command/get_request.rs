use {
    crate::{
        config::GetRequestOptions,
        ethereum::PythContract,
    },
    std::{
        error::Error,
        sync::Arc,
    },
};

/// Get the on-chain request metadata for a provider and sequence number.
pub async fn get_request(opts: &GetRequestOptions) -> Result<(), Box<dyn Error>> {
    // Initialize a Provider to interface with the EVM contract.
    let contract = Arc::new(
        PythContract::from_config(&opts.config.load()?.get_chain_config(&opts.chain_id)?).await?,
    );

    let r = contract
        .get_request(opts.provider, opts.sequence)
        .call()
        .await?;
    println!("Found request: {:?}", r);

    Ok(())
}
