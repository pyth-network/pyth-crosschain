use {
    crate::{
        api,
        chain::ethereum::{
            PythContract,
            SignablePythContract,
        },
        command::register_provider::CommitmentMetadata,
        config::{
            Config,
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
    ethers::{
        middleware::MiddlewareBuilder,
        providers::Middleware,
        signers::{
            LocalWallet,
            Signer,
        },
    },
    futures::future::join_all,
    std::{
        collections::HashMap,
        net::SocketAddr,
        sync::Arc,
        vec,
    },
    tokio::{
        spawn,
        sync::{
            mpsc,
            watch,
        },
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


pub async fn run_keeper_with_exit_check(
    chains: HashMap<String, api::BlockchainState>,
    config: Config,
    rx_exit: watch::Receiver<bool>,
    private_key: String,
) -> Result<()> {
    while !*rx_exit.borrow() {
        // TODO: this may not work as we have passed the ownership here
        // for the loop to work again we should have pass a copy
        // Is it better to use Arc?
        // Clone can be expensive.
        if let Err(e) = run_keeper(
            chains.clone(),
            config.clone(),
            rx_exit.clone(),
            private_key.clone(),
        )
        .await
        {
            tracing::error!("Keeper service failed. {:?}", e);
        }

        // Wait for 5 seconds before restarting the service
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }

    Ok(())
}

pub async fn run_keeper(
    chains: HashMap<String, api::BlockchainState>,
    config: Config,
    rx_exit: watch::Receiver<bool>,
    private_key: String,
) -> Result<()> {
    let mut handles = Vec::new();
    for (chain_id, chain_config) in chains {
        let rx_exit = rx_exit.clone();
        let chain_eth_config = config.chains.get(&chain_id).unwrap().clone();
        let private_key = private_key.clone();
        let chain_id = chain_id.clone();
        handles.push(spawn(async move {
            tracing::info!("Starting keeper for chain: {}", &chain_id);
            let latest_safe_block = chain_config
                .contract
                .get_block_number(chain_config.confirmed_block_status)
                .await?
                - chain_config.reveal_delay_blocks;

            tracing::info!(
                "Latest safe block for chain {}: {} ",
                &chain_id,
                &latest_safe_block
            );

            // create a contract and a nonce manager
            let contract =
                Arc::new(SignablePythContract::from_config(&chain_eth_config, &private_key).await?);
            let provider = contract.client().provider().clone();
            let nonce_manager =
                Arc::new(provider.nonce_manager(private_key.parse::<LocalWallet>()?.address()));

            nonce_manager
                .initialize_nonce(Some(latest_safe_block.into()))
                .await?;

            let handle_backlog = spawn(keeper::handle_backlog(
                chain_id.clone(),
                chain_config.provider_address.clone(),
                latest_safe_block,
                Arc::clone(&chain_config.contract),
                Arc::clone(&chain_config.state),
                Arc::clone(&nonce_manager),
                Arc::clone(&contract),
                rx_exit.clone(),
                chain_eth_config.gas_limit,
            ));

            let (tx, rx) = mpsc::channel::<keeper::BlockRange>(1000);

            let handle_watch_blocks = spawn(keeper::watch_blocks(
                chain_id.clone(),
                chain_eth_config.clone(),
                Arc::clone(&chain_config.contract),
                chain_config.clone(),
                latest_safe_block,
                tx.clone(),
                rx_exit.clone(),
            ));
            let handle_events = spawn(keeper::handle_events(
                chain_id.clone(),
                chain_config.provider_address,
                rx_exit.clone(),
                rx,
                Arc::clone(&chain_config.contract),
                Arc::clone(&chain_config.state),
                Arc::clone(&nonce_manager),
                Arc::clone(&contract),
                chain_eth_config.gas_limit,
            ));

            let tasks = join_all([handle_backlog, handle_watch_blocks, handle_events]).await;
            for task in tasks {
                task??;
            }

            Ok::<(), Error>(())
        }));
    }

    let tasks = join_all(handles).await;
    for task in tasks {
        task??;
    }

    Ok::<(), Error>(())
}

pub async fn run(opts: &RunOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    let private_key = opts.load_private_key()?;
    let secret = opts.randomness.load_secret()?;
    let (tx_exit, rx_exit) = watch::channel(false);

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

    let chains_clone = chains.clone();

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
    spawn(run_keeper_with_exit_check(
        chains_clone,
        config,
        rx_exit.clone(),
        private_key,
    ));

    run_api(opts.addr.clone(), chains, rx_exit).await?;

    Ok(())
}
