use {
    crate::{
        api,
        chain::{
            self,
            ethereum::{
                self,
                PythContract,
            },
        },
        command::register_provider::CommitmentMetadata,
        config::{
            Config,
            EthereumConfig,
            RunOptions,
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
    axum::{
        response::sse::Event,
        Router,
    },
    std::{
        collections::HashMap,
        os::unix::thread,
        sync::Arc,
        thread::{
            self,
            sleep,
        },
        time::Duration,
    },
    tower_http::cors::CorsLayer,
    utoipa::OpenApi,
    utoipa_swagger_ui::SwaggerUi,
};

pub async fn handle_events(
    events: Vec<ethereum::RequestedWithCallbackFilter>,
    contract: &SignablePythContract,
    chain_config: &EthereumConfig,
) -> Result<()> {
    for event in events {
        let call = contract.reveal_with_callback(
            event.request.provider,
            event.request.sequence_number,
            event.user_random_number,
            // TODO: inject provider commitment here
        );
        let mut gas_estimate = call.estimate_gas().await?;
        let gas_multiplier = U256::from(2); //TODO: smarter gas estimation
        gas_estimate = gas_estimate * gas_multiplier;
        let call_with_gas = call.gas(gas_estimate);
        if let Some(r) = call_with_gas.send().await?.await? {
            tracing::info!("Revealed: {:?}", r);
        }
    }

    Ok(())
}

pub fn run_keeper(&chains: HashMap<api::ChainId, EthereumConfig>) -> Result<()> {
    for (chain_id, chain_config) in chains {
        thread::spawn(|| {
            // Initialize a Provider to interface with the EVM contract.
            let contract =
                Arc::new(SignablePythContract::from_config(&chain_config, &private_key).await?);

            let starting_block = contract
                .get_block_number(chain_config.confirmed_block_status)
                .await?;

            // TODO: inject from the config
            let block_backlog: u32 = 10_000;

            // TODO: inject from the config
            let sleep_duration: u32 = 5 * 60;

            thread::spawn(|| {
                let events = contract
                    .get_request_with_callback_events(
                        starting_block,
                        // TODO: maybe add a check max of 0 or this number
                        starting_block - block_backlog,
                    )
                    .await?;

                handle_events(events, &contract, chain_config)
            });

            // every 5 minutes run get event
            loop {
                let events = contract
                    .get_request_with_callback_events(
                        starting_block,
                        starting_block + block_backlog,
                    )
                    .await?;

                handleEvents(events, &contract, &chain_config).await?;

                sleep(Duration::from_secs(sleep_duration));
            }
        });
    }
    Ok(())
}

pub async fn run(opts: &RunOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;

    // TODO: not sure if this is the right way
    thread::spawn(|| {
        run_keeper(&config.chains);
    });

    #[derive(OpenApi)]
    #[openapi(
    paths(
    crate::api::revelation,
    crate::api::chain_ids,
    ),
    components(
    schemas(
    crate::api::GetRandomValueResponse,
    crate::api::Blob,
    crate::api::BinaryEncoding,
    )
    ),
    tags(
    (name = "fortuna", description = "Random number service for the Pyth Entropy protocol")
    )
    )]
    struct ApiDoc;

    let secret = opts.randomness.load_secret()?;


    let mut chains = HashMap::new();
    for (chain_id, chain_config) in &config.chains {
        let contract = Arc::new(PythContract::from_config(&chain_config)?);
        let provider_info = contract.get_provider_info(opts.provider).call().await?;

        // Reconstruct the hash chain based on the metadata and check that it matches the on-chain commitment.
        // TODO: we should instantiate the state here with multiple hash chains.
        // This approach works fine as long as we haven't rotated the commitment (i.e., all user requests
        // are for the most recent chain).
        // TODO: we may want to load the hash chain in a lazy/fault-tolerant way. If there are many blockchains,
        // then it's more likely that some RPC fails. We should tolerate these faults and generate the hash chain
        // later when a user request comes in for that chain.
        let metadata =
            bincode::deserialize::<CommitmentMetadata>(&provider_info.commitment_metadata)?;

        let hash_chain = PebbleHashChain::from_config(
            &secret,
            &chain_id,
            &opts.provider,
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
            return Err(anyhow!("The root of the generated hash chain for chain id {} does not match the commitment. Are the secret and chain length configured correctly?", &chain_id).into());
        } else {
            tracing::info!("Root of chain id {} matches commitment", &chain_id);
        }

        let state = api::BlockchainState {
            state: Arc::new(chain_state),
            contract,
            provider_address: opts.provider,
            reveal_delay_blocks: chain_config.reveal_delay_blocks,
            confirmed_block_status: chain_config.confirmed_block_status,
        };

        chains.insert(chain_id.clone(), state);
    }

    let metrics_registry = api::Metrics::new();
    let api_state = api::ApiState {
        chains:  Arc::new(chains),
        metrics: Arc::new(metrics_registry),
    };

    // Initialize Axum Router. Note the type here is a `Router<State>` due to the use of the
    // `with_state` method which replaces `Body` with `State` in the type signature.
    let app = Router::new();
    let app = app
        .merge(SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi()))
        .merge(api::routes(api_state))
        // Permissive CORS layer to allow all origins
        .layer(CorsLayer::permissive());


    tracing::info!("Starting server on: {:?}", &opts.addr);
    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    axum::Server::try_bind(&opts.addr)?
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
