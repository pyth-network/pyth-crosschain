use {
    crate::{
        config::RequestRandomnessOptions,
        ethereum::PythContract,
    },
    ethers::core::types::Address,
    sha3::Digest,
    std::{
        error::Error,
        sync::Arc,
    },
};

pub async fn request_randomness(opts: &RequestRandomnessOptions) -> Result<(), Box<dyn Error>> {
    let contract = Arc::new(PythContract::from_opts(&opts.ethereum).await?);

    let user_randomness = rand::random::<[u8; 32]>();
    let sequence_number = contract
        .request_wrapper(&opts.provider, &user_randomness, false)
        .await?;

    println!("sequence number: {:#?}", sequence_number);

    Ok(())
}
