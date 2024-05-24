use {
    crate::{
        api::{
            get_register_uri,
            ChainId,
        },
        chain::ethereum::SignablePythContract,
        config::{
            Config,
            EthereumConfig,
            ProviderConfig,
            WithdrawFeesOptions,
        },
        state::PebbleHashChain,
    },
    anyhow::{
        anyhow,
        Result,
    },
    ethers::{
        abi::{
            AbiEncode,
            Bytes,
        },
        middleware::Middleware,
        providers::{
            Http,
            Provider,
        },
        signers::{
            LocalWallet,
            Signer,
        },
        types::U256,
    },
    std::sync::Arc,
};

pub async fn withdraw_fees(opts: &WithdrawFeesOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;

    match opts.chain_id.clone() {
        Some(chain_id) => {
            let chain_config = &config.get_chain_config(&chain_id)?;
            withdraw_fees_for_chain(&config.provider, chain_config).await?;
        }
        None => {
            for (chain_id, chain_config) in config.chains.iter() {
                tracing::info!("Withdrawing fees for chain: {}", chain_id);
                withdraw_fees_for_chain(&config.provider, chain_config).await?;
            }
        }
    }
    Ok(())
}

pub async fn withdraw_fees_for_chain(
    provider_config: &ProviderConfig,
    chain_config: &EthereumConfig,
) -> Result<()> {
    let private_key_string = provider_config.private_key.load()?.ok_or(anyhow!(
        "Please specify a provider private key in the config"
    ))?;


    // Initialize a Provider to interface with the EVM contract.
    let contract =
        Arc::new(SignablePythContract::from_config(&chain_config, &private_key_string).await?);

    let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;
    let wallet = contract.wallet();
    let balance = provider.get_balance(wallet.address(), None).await?;

    tracing::info!("Initial provider balance");
    tracing::info!("Address: {:?}", wallet.address());
    tracing::info!("Balance: {} wei", balance);

    tracing::info!("Fetching provider fees");
    let provider_info = contract
        .get_provider_info(provider_config.address)
        .call()
        .await?;
    let fees = provider_info.accrued_fees_in_wei;
    tracing::info!("Accrued fees: {} wei", fees);

    // TODO: If accrued fees are nontrivial

    let tx_result = contract.withdraw(fees).send().await?.await?;
    match tx_result {
        Some(receipt) => {
            tracing::info!("Claim transaction hash {:?}", receipt.transaction_hash);
        }
        None => {
            tracing::warn!("No transaction receipt. Unclear what happened to the transaction");
        }
    }

    let balance = provider.get_balance(wallet.address(), None).await?;

    tracing::info!("Final provider balance");
    tracing::info!("Address: {:?}", wallet.address());
    tracing::info!("Balance: {} wei", balance);

    Ok(())
}
