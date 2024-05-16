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
    ethers::{
        middleware::Middleware,
        providers::{
            Http,
            Provider,
        },
        types::BlockNumber,
    },
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{
            family::Family,
            gauge::Gauge,
        },
        registry::Registry,
    },
    std::{
        collections::HashMap,
        net::SocketAddr,
        sync::Arc,
        time::{
            Duration,
            SystemTime,
            UNIX_EPOCH,
        },
    },
    tokio::{
        spawn,
        sync::{
            watch,
            RwLock,
        },
        time,
    },
    tower_http::cors::CorsLayer,
    utoipa::OpenApi,
    utoipa_swagger_ui::SwaggerUi,
};

/// Track metrics in this interval
const TRACK_INTERVAL: Duration = Duration::from_secs(10);

pub async fn run_api(
    socket_addr: SocketAddr,
    chains: HashMap<String, api::BlockchainState>,
    metrics_registry: Arc<RwLock<Registry>>,
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

    let api_state = api::ApiState::new(chains, metrics_registry).await;

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
    metrics_registry: Arc<RwLock<Registry>>,
) -> Result<()> {
    let mut handles = Vec::new();
    for (chain_id, chain_config) in chains {
        let chain_eth_config = config
            .chains
            .get(&chain_id)
            .expect("All chains should be present in the config file")
            .clone();
        let private_key = private_key.clone();
        let chain_writer = chain_eth_config
            .get_writer(chain_config.provider_address, &private_key)
            .await?;
        handles.push(spawn(keeper::run_keeper_threads(
            chain_writer,
            private_key,
            chain_eth_config,
            chain_config.clone(),
            metrics_registry.clone(),
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

        let provider_info = contract.get_provider_info(opts.provider).call().await?;
        let latest_metadata =
            bincode::deserialize::<CommitmentMetadata>(&provider_info.commitment_metadata)
                .map_err(|e| {
                    anyhow!(
                        "Chain: {} - Failed to deserialize commitment metadata: {}",
                        &chain_id,
                        e
                    )
                })?;

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

    let metrics_registry = Arc::new(RwLock::new(Registry::default()));

    if let Some(keeper_private_key) = opts.load_keeper_private_key()? {
        spawn(run_keeper(
            chains.clone(),
            config.clone(),
            keeper_private_key,
            metrics_registry.clone(),
        ));
    }

    // Spawn a thread to track latest block lag. This helps us know if the rpc is up and updated with the latest block.
    spawn(track_block_timestamp_lag(config, metrics_registry.clone()));

    run_api(opts.addr.clone(), chains, metrics_registry, rx_exit).await?;

    Ok(())
}


#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct ChainLabel {
    pub chain_id: String,
}

/// Tracks the difference between the server timestamp and the latest block timestamp for each chain
pub async fn track_block_timestamp_lag(config: Config, metrics_registry: Arc<RwLock<Registry>>) {
    let metrics = Family::<ChainLabel, Gauge>::default();
    metrics_registry.write().await.register(
        "block_timestamp_lag",
        "The difference between server timestamp and latest block timestamp",
        metrics.clone(),
    );
    loop {
        for (chain_id, chain_config) in &config.chains {
            let chain_id = chain_id.clone();
            let chain_config = chain_config.clone();
            let metrics = metrics.clone();

            spawn(async move {
                let chain_id = chain_id.clone();
                let chain_config = chain_config.clone();

                let provider = match Provider::<Http>::try_from(&chain_config.geth_rpc_addr) {
                    Ok(r) => r,
                    Err(e) => {
                        tracing::error!(
                            "Failed to create provider for chain id {} - {:?}",
                            &chain_id,
                            e
                        );
                        return;
                    }
                };

                match provider.get_block(BlockNumber::Latest).await {
                    Ok(b) => {
                        if let Some(block) = b {
                            let block_timestamp = block.timestamp;
                            let server_timestamp = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap()
                                .as_secs();
                            let lag: i64 =
                                (server_timestamp as i64) - (block_timestamp.as_u64() as i64);

                            metrics
                                .get_or_create(&ChainLabel {
                                    chain_id: chain_id.clone(),
                                })
                                .set(lag);
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to get block for chain id {} - {:?}", &chain_id, e);
                    }
                };
            });
        }

        time::sleep(TRACK_INTERVAL).await;
    }
}
