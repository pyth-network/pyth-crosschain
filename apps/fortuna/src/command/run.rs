use {
    crate::{
        api::{
            self,
            BlockchainState,
            ChainId,
        },
        chain::ethereum::PythContract,
        command::register_provider::CommitmentMetadata,
        config::{
            Commitment,
            Config,
            ProviderConfig,
            RunOptions,
        },
        keeper,
        state::{
            HashChainState,
            PebbleHashChain,
        },
    },
    anyhow::{
        anyhow,
        Error,
        Result,
    },
    axum::Router,
    std::{
        collections::HashMap,
        net::SocketAddr,
        sync::Arc,
    },
    tokio::{
        spawn,
        sync::watch,
    },
    tower_http::cors::CorsLayer,
    utoipa::OpenApi,
    utoipa_swagger_ui::SwaggerUi,
};

pub async fn run_api(
    socket_addr: SocketAddr,
    chains: HashMap<String, api::BlockchainState>,
    mut rx_exit: watch::Receiver<bool>,
) -> Result<()> {
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

    tracing::info!("Starting server on: {:?}", &socket_addr);
    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    axum::Server::try_bind(&socket_addr)?
        .serve(app.into_make_service())
        .with_graceful_shutdown(async {
            // It can return an error or an Ok(()). In both cases, we would shut down.
            // As Ok(()) means, exit signal (ctrl + c) was received.
            // And Err(e) means, the sender was dropped which should not be the case.
            let _ = rx_exit.changed().await;

            tracing::info!("Shutting down RPC server...");
        })
        .await?;

    Ok(())
}


pub async fn run_keeper(
    chains: HashMap<String, api::BlockchainState>,
    config: Config,
    private_key: String,
) -> Result<()> {
    let mut handles = Vec::new();
    for (chain_id, chain_config) in chains {
        let chain_eth_config = config
            .chains
            .get(&chain_id)
            .expect("All chains should be present in the config file")
            .clone();
        let private_key = private_key.clone();
        handles.push(spawn(keeper::run_keeper_threads(
            private_key,
            chain_eth_config,
            chain_config.clone(),
        )));
    }

    Ok(())
}

pub async fn run(opts: &RunOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    let provider_config = opts
        .provider_config
        .provider_config
        .as_ref()
        .map(|path| ProviderConfig::load(&path).expect("Failed to load provider config"));
    let private_key = opts.load_private_key()?;
    let secret = opts.randomness.load_secret()?;
    let (tx_exit, rx_exit) = watch::channel(false);

    let mut chains: HashMap<ChainId, BlockchainState> = HashMap::new();
    for (chain_id, chain_config) in &config.chains {
        let contract = Arc::new(PythContract::from_config(&chain_config)?);
        let provider_chain_config = provider_config
            .as_ref()
            .and_then(|c| c.get_chain_config(chain_id));
        let mut provider_commitments = provider_chain_config
            .as_ref()
            .map(|c| c.get_sorted_commitments())
            .unwrap_or_else(|| Vec::new());
        println!("{} {:?}", chain_id, provider_commitments);

        let provider_info = contract.get_provider_info(opts.provider).call().await?;
        let latest_metadata =
            bincode::deserialize::<CommitmentMetadata>(&provider_info.commitment_metadata)?;

        provider_commitments.push(Commitment {
            seed:                                latest_metadata.seed,
            chain_length:                        latest_metadata.chain_length,
            original_commitment_sequence_number: provider_info.original_commitment_sequence_number,
        });

        // TODO: we may want to load the hash chain in a lazy/fault-tolerant way. If there are many blockchains,
        // then it's more likely that some RPC fails. We should tolerate these faults and generate the hash chain
        // later when a user request comes in for that chain.

        let mut offsets = Vec::<usize>::new();
        let mut hash_chains = Vec::<PebbleHashChain>::new();

        for commitment in &provider_commitments {
            let offset = commitment.original_commitment_sequence_number.try_into()?;
            offsets.push(offset);

            let pebble_hash_chain = PebbleHashChain::from_config(
                &secret,
                &chain_id,
                &opts.provider,
                &chain_config.contract_addr,
                &commitment.seed,
                commitment.chain_length,
            )?;
            hash_chains.push(pebble_hash_chain);
        }

        let chain_state = HashChainState {
            offsets,
            hash_chains,
        };

        if chain_state.reveal(provider_info.original_commitment_sequence_number)?
            != provider_info.original_commitment
        {
            return Err(anyhow!("The root of the generated hash chain for chain id {} does not match the commitment. Are the secret and chain length configured correctly?", &chain_id).into());
        } else {
            tracing::info!("Root of chain id {} matches commitment", &chain_id);
        }

        let state = api::BlockchainState {
            id: chain_id.clone(),
            state: Arc::new(chain_state),
            contract,
            provider_address: opts.provider,
            reveal_delay_blocks: chain_config.reveal_delay_blocks,
            confirmed_block_status: chain_config.confirmed_block_status,
        };

        chains.insert(chain_id.clone(), state);
    }


    // Listen for Ctrl+C so we can set the exit flag and wait for a graceful shutdown.
    spawn(async move {
        tracing::info!("Registered shutdown signal handler...");
        tokio::signal::ctrl_c().await.unwrap();
        tracing::info!("Shut down signal received, waiting for tasks...");
        // no need to handle error here, as it will only occur when all the
        // receiver has been dropped and that's what we want to do
        tx_exit.send(true)?;

        Ok::<(), Error>(())
    });
    spawn(run_keeper(chains.clone(), config, private_key));

    run_api(opts.addr.clone(), chains, rx_exit).await?;

    Ok(())
}
