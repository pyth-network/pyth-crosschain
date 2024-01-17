use {
    crate::{
        chain::ethereum::SignablePythContract,
        command::{
            register_provider,
            register_provider::CommitmentMetadata,
        },
        config::{
            Config,
            SetupProviderOptions,
            RegisterProviderOptions,
        },
        state::{
            HashChainState,
            PebbleHashChain,
        },
    },
    anyhow::Result,
    ethers::{
        signers::{
            LocalWallet,
            Signer,
        },
        types::Address,
    },
    std::sync::Arc,
};

/// Register as a randomness provider.
/// Re-register
/// Update fee for the randomness provider.
/// Update uri for the randomness provider.
pub async fn setup_provider(opts: &SetupProviderOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    let private_key = opts.load_private_key()?;
    let secret = opts.randomness.load_secret()?;
    let provider_address = private_key.clone().parse::<LocalWallet>()?.address();

    for (chain_id, chain_config) in &config.chains {
        // Initialize a Provider to interface with the EVM contract.
        let contract =
            Arc::new(SignablePythContract::from_config(&chain_config, &private_key).await?);
        let provider_info = contract.get_provider_info(provider_address).call().await?;

        let mut register = false;

        // this covers both end_sequence_number == 0 && sequence_number == 0
        // and end_sequence_number <= sequence_number
        if provider_info.end_sequence_number <= provider_info.sequence_number {
            tracing::info!("endSequenceNumber is lte sequenceNumber.");
            tracing::info!("Registering to {}", &chain_id);
            register = true;
        } else {
            let metadata =
                bincode::deserialize::<CommitmentMetadata>(&provider_info.commitment_metadata)?;

            let hash_chain = PebbleHashChain::from_config(
                &secret,
                &chain_id,
                &provider_address,
                &chain_config.contract_addr,
                &metadata.seed,
                metadata.chain_length,
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
                tracing::info!("The root of the generated hash chain for chain id {} does not match the commitment",  &chain_id);
                tracing::info!("Registering to {}", &chain_id);
                register = true;
            }
        }

        if register {
            register_provider(&RegisterProviderOptions {
                config: opts.config.clone(),
                chain_id: chain_id.clone(),
                private_key: private_key.clone(),
                randomness: opts.randomness.clone(),
                fee: opts.fee,
                uri: opts.uri.clone(),
            }).await?;
        } else {
            if provider_info.fee_in_wei != opts.fee {
                if let Some(r) = contract.setProviderFee(opts.fee).send().await?.await? {
                    tracing::info!("Updated provider fee: {:?}", r);
                }
            }

            if bincode::deserialize::<String>(&provider_info.uri)? != opts.uri {
                if let Some(r) = contract
                    .setProviderUri(bincode::serialize(&opts.uri)?.into())
                    .send()
                    .await?
                    .await?
                {
                    tracing::info!("Updated provider uri: {:?}", r);
                }
            }
        }
    }
    Ok(())
}
