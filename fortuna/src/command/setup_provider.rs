use {
    crate::{
        api::get_register_uri,
        chain::ethereum::SignablePythContract,
        command::{
            register_provider,
            register_provider::CommitmentMetadata,
        },
        config::{
            Config,
            RegisterProviderOptions,
            SetupProviderOptions,
        },
        state::{
            HashChainState,
            PebbleHashChain,
        },
    },
    anyhow::Result,
    ethers::signers::{
        LocalWallet,
        Signer,
    },
    std::sync::Arc,
};

/// Setup provider for all the chains.
/// 1. Register if there was no previous registration.
/// 2. Re-register if there are no more random numbers to request on the contract.
/// 3. Re-register if there is a mismatch in generated hash chain.
/// 4. Update provider fee if there is a mismatch with the fee set on contract.
/// 5. Update provider uri if there is a mismatch with the uri set on contract.
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
        tracing::info!("Provider info: {:?}", provider_info);

        let mut register = false;

        let uri = get_register_uri(&opts.base_uri, &chain_id);

        // This condition satisfies for both when there is no registration and when there are no
        // more random numbers left to request
        if provider_info.end_sequence_number <= provider_info.sequence_number {
            tracing::info!(
                "endSequenceNumber <= sequenceNumber. endSequenceNumber={0}, sequenceNumber={1}",
                provider_info.end_sequence_number,
                provider_info.sequence_number
            );
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
                uri,
            })
            .await?;
        } else {
            if provider_info.fee_in_wei != opts.fee {
                if let Some(r) = contract.set_provider_fee(opts.fee).send().await?.await? {
                    tracing::info!("Updated provider fee: {:?}", r);
                }
            }

            if bincode::deserialize::<String>(&provider_info.uri)? != uri {
                if let Some(receipt) = contract
                    .set_provider_uri(bincode::serialize(&uri)?.into())
                    .send()
                    .await?
                    .log_msg("Pending transfer hash")
                    .await?
                {
                    tracing::info!("Updated provider uri: {:?}", receipt);
                }
            }
        }
    }
    Ok(())
}
