use {
    crate::{
        api::{
            get_register_uri,
            ChainId,
        },
        chain::ethereum::{
            ProviderInfo,
            SignablePythContract,
        },
        command::{
            register_provider,
            register_provider::CommitmentMetadata,
        },
        config::{
            Config,
            EthereumConfig,
            ProviderConfig,
            RegisterProviderOptions,
            SetupProviderOptions,
        },
        state::{
            HashChainState,
            PebbleHashChain,
        },
    },
    anyhow::{
        anyhow,
        Result,
    },
    ethers::{
        abi::Bytes as AbiBytes,
        signers::{
            LocalWallet,
            Signer,
        },
        types::Bytes,
    },
    std::sync::Arc,
    tracing::Instrument,
};

/// Setup provider for all the chains.
pub async fn setup_provider(opts: &SetupProviderOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    for (chain_id, chain_config) in &config.chains {
        setup_chain_provider(opts, chain_id, chain_config).await?;
    }
    Ok(())
}


/// Setup provider for a single chain.
/// 1. Register if there was no previous registration.
/// 2. Re-register if there are no more random numbers to request on the contract.
/// 3. Re-register if there is a mismatch in generated hash chain.
/// 4. Update provider fee if there is a mismatch with the fee set on contract.
/// 5. Update provider uri if there is a mismatch with the uri set on contract.
#[tracing::instrument(name="setup_chain_provider", skip_all, fields(chain_id=chain_id))]
async fn setup_chain_provider(
    opts: &SetupProviderOptions,
    chain_id: &ChainId,
    chain_config: &EthereumConfig,
) -> Result<()> {
    tracing::info!("Setting up provider for chain: {0}", chain_id);
    let provider_config = ProviderConfig::load(&opts.provider_config.provider_config)?;
    let private_key = opts.load_private_key()?;
    let provider_address = private_key.clone().parse::<LocalWallet>()?.address();
    let provider_fee = provider_config.get_chain_config(chain_id)?.fee;
    // Initialize a Provider to interface with the EVM contract.
    let contract = Arc::new(SignablePythContract::from_config(&chain_config, &private_key).await?);

    tracing::info!("Fetching provider info");
    let provider_info = contract.get_provider_info(provider_address).call().await?;
    tracing::info!("Provider info: {:?}", provider_info);

    let mut register = false;

    let uri = get_register_uri(&opts.base_uri, &chain_id)?;

    // This condition satisfies for both when there is no registration and when there are no
    // more random numbers left to request
    if provider_info.end_sequence_number <= provider_info.sequence_number {
        tracing::info!(
            "endSequenceNumber <= sequenceNumber. endSequenceNumber={}, sequenceNumber={}",
            provider_info.end_sequence_number,
            provider_info.sequence_number
        );
        register = true;
    } else {
        let metadata =
            bincode::deserialize::<CommitmentMetadata>(&provider_info.commitment_metadata)
                .map_err(|e| {
                    anyhow!(
                        "Chain: {} - Failed to deserialize commitment metadata: {}",
                        &chain_id,
                        e
                    )
                })?;

        let secret = opts.randomness.load_secret()?;
        let hash_chain = PebbleHashChain::from_config(
            &secret,
            &chain_id,
            &provider_address,
            &chain_config.contract_addr,
            &metadata.seed,
            opts.randomness.chain_length,
        )?;
        let chain_state = HashChainState {
            offsets:     vec![provider_info
                .original_commitment_sequence_number
                .try_into()?],
            hash_chains: vec![hash_chain],
        };


        if chain_state.reveal(provider_info.original_commitment_sequence_number)?
            != provider_info.original_commitment
        {
            tracing::info!("The root of the generated hash chain does not match the commitment",);
            register = true;
        }
    }

    if register {
        tracing::info!("Registering");
        register_provider(&RegisterProviderOptions {
            config: opts.config.clone(),
            chain_id: chain_id.clone(),
            private_key: private_key.clone(),
            randomness: opts.randomness.clone(),
            fee: provider_fee,
            uri,
        })
        .await
        .map_err(|e| anyhow!("Chain: {} - Failed to register provider: {}", &chain_id, e))?;
        tracing::info!("Registered");
    } else {
        sync_fee(&contract, &provider_info, provider_fee)
            .in_current_span()
            .await?;
        sync_uri(&contract, &provider_info, uri)
            .in_current_span()
            .await?;
    }
    Ok(())
}

async fn sync_uri(
    contract: &Arc<SignablePythContract>,
    provider_info: &ProviderInfo,
    uri: String,
) -> Result<()> {
    let uri_as_bytes: Bytes = AbiBytes::from(uri.as_str()).into();
    if &provider_info.uri != &uri_as_bytes {
        tracing::info!("Updating provider uri to {}", uri);
        if let Some(receipt) = contract
            .set_provider_uri(uri_as_bytes)
            .send()
            .await?
            .await?
        {
            tracing::info!("Updated provider uri: {:?}", receipt);
        }
    }
    Ok(())
}

async fn sync_fee(
    contract: &Arc<SignablePythContract>,
    provider_info: &ProviderInfo,
    provider_fee: u128,
) -> Result<()> {
    if provider_info.fee_in_wei != provider_fee {
        tracing::info!("Updating provider fee {}", provider_fee);
        if let Some(r) = contract
            .set_provider_fee(provider_fee)
            .send()
            .await?
            .await?
        {
            tracing::info!("Updated provider fee: {:?}", r);
        }
    }
    Ok(())
}
