use {
    crate::{
        chain::ethereum::SignablePythContract,
        command::register_provider::CommitmentMetadata,
        config::{
            Config,
            RegisterProviderOnAllOptions,
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
pub async fn register_provider_on_all(opts: &RegisterProviderOnAllOptions) -> Result<()> {
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
            // Create a new random hash chain.
            let random = rand::random::<[u8; 32]>();

            let commitment_length = opts.randomness.chain_length;
            let mut chain = PebbleHashChain::from_config(
                &secret,
                &chain_id,
                &provider_address,
                &chain_config.contract_addr,
                &random,
                commitment_length,
            )?;

            // Arguments to the contract to register our new provider.
            let fee_in_wei = opts.fee;
            let commitment = chain.reveal()?;
            // Store the random seed and chain length in the metadata field so that we can regenerate the hash
            // chain at-will. (This is secure because you can't generate the chain unless you also have the secret)
            let commitment_metadata = CommitmentMetadata {
                seed:         random,
                chain_length: commitment_length,
            };

            if let Some(r) = contract
                .register(
                    fee_in_wei,
                    commitment,
                    bincode::serialize(&commitment_metadata)?.into(),
                    commitment_length,
                    bincode::serialize(&opts.uri)?.into(),
                )
                .send()
                .await?
                .await?
            {
                tracing::info!("Registered provider: {:?}", r);
            }
        } else {
            if provider_info.fee_in_wei != opts.fee {
                if let Some(r) = contract.setProviderFee(fee_in_wei).send().await?.await? {
                    tracing::info!("Updated provider fee: {:?}", r);
                }
            }

            if provider_info.uri != opts.uri {
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
