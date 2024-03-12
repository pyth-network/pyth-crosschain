use {
    crate::{
        api::get_register_uri,
        chain::ethereum::SignablePythContract,
        command::register_provider::{
            self,
            CommitmentMetadata,
        },
        config::{
            Config,
            RegisterProviderOptions,
            RunKeeperOptions,
            SetupProviderOptions,
        },
        state::{
            HashChainState,
            PebbleHashChain,
        },
    },
    anyhow::Result,
    ethers::{
        abi::Bytes as AbiBytes,
        contract::builders::Event,
        signers::{
            LocalWallet,
            Signer,
        },
        types::{
            BlockNumber,
            Bytes,
        },
    },
    std::sync::Arc,
};

pub async fn run_keeper(opts: &RunKeeperOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    let private_key = opts.load_private_key()?;
    let secret = opts.randomness.load_secret()?;
    let provider_address = private_key.clone().parse::<LocalWallet>()?.address();

    for (chain_id, chain_config) in &config.chains {
        // Initialize a Provider to interface with the EVM contract.
        let contract =
            Arc::new(SignablePythContract::from_config(&chain_config, &private_key).await?);

        let mut event = contract.requested_filter();
        event.filter = event.filter.from_block(251727).to_block(251788);
        let res = event.query().await?;
        println!("{:?}", res);

        let a = contract.events();
        tracing::info!("{0}: subscribed to all events", chain_id);
        tracing::info!("{:?}", a);
    }
    Ok(())
}
