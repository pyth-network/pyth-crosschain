use {
    crate::{
        api::{self, ApiBlockChainState, BlockchainState, ChainId},
        chain::ethereum::InstrumentedPythContract,
        command::register_provider::CommitmentMetadata,
        config::{Commitment, Config, EthereumConfig, ProviderConfig, RunOptions},
        eth_utils::traced_client::RpcMetrics,
        history::History,
        keeper::{self, keeper_metrics::KeeperMetrics},
        state::{HashChainState, MonitoredHashChainState, PebbleHashChain},
    },
    anyhow::{anyhow, Error, Result},
    axum::Router,
    ethers::types::Address,
    prometheus_client::{encoding::EncodeLabelSet, registry::Registry},
    std::{collections::HashMap, net::SocketAddr, sync::Arc},
    tokio::{
        spawn,
        sync::{watch, RwLock},
    },
    tower_http::cors::CorsLayer,
    utoipa::OpenApi,
    utoipa_swagger_ui::SwaggerUi,
};

pub async fn run_api(
    socket_addr: SocketAddr,
    chains: Arc<RwLock<HashMap<String, ApiBlockChainState>>>,
    metrics_registry: Arc<RwLock<Registry>>,
    history: Arc<History>,
    mut rx_exit: watch::Receiver<bool>,
) -> Result<()> {
    #[derive(OpenApi)]
    #[openapi(
    paths(
    crate::api::revelation,
    crate::api::chain_ids,
    crate::api::explorer,
    ),
    components(
    schemas(
    crate::api::GetRandomValueResponse,
    crate::history::RequestStatus,
    crate::history::RequestEntryState,
    crate::api::Blob,
    crate::api::BinaryEncoding,
    crate::api::StateTag,
    crate::api::ExplorerResponse,
    )
    ),
    tags(
    (name = "fortuna", description = "Random number service for the Pyth Entropy protocol")
    )
    )]
    struct ApiDoc;

    let api_state = api::ApiState::new(chains, metrics_registry, history).await;

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

pub async fn run(opts: &RunOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    let secret = config.provider.secret.load()?.ok_or(anyhow!(
        "Please specify a provider secret in the config file."
    ))?;
    let (tx_exit, rx_exit) = watch::channel(false);
    let metrics_registry = Arc::new(RwLock::new(Registry::default()));
    let rpc_metrics = Arc::new(RpcMetrics::new(metrics_registry.clone()).await);

    let keeper_metrics: Arc<KeeperMetrics> =
        Arc::new(KeeperMetrics::new(metrics_registry.clone()).await);
    let keeper_private_key_option = config.keeper.private_key.load()?;
    if keeper_private_key_option.is_none() {
        tracing::info!("Not starting keeper service: no keeper private key specified. Please add one to the config if you would like to run the keeper service.")
    }
    let chains: Arc<RwLock<HashMap<ChainId, ApiBlockChainState>>> = Arc::new(RwLock::new(
        config
            .chains
            .keys()
            .map(|chain_id| (chain_id.clone(), ApiBlockChainState::Uninitialized))
            .collect(),
    ));
    let history = Arc::new(History::new().await?);
    for (chain_id, chain_config) in config.chains.clone() {
        keeper_metrics.add_chain(chain_id.clone(), config.provider.address);
        let keeper_metrics = keeper_metrics.clone();
        let keeper_private_key_option = keeper_private_key_option.clone();
        let chains = chains.clone();
        let secret_copy = secret.clone();
        let rpc_metrics = rpc_metrics.clone();
        let provider_config = config.provider.clone();
        let history = history.clone();
        spawn(async move {
            loop {
                let setup_result = setup_chain_and_run_keeper(
                    provider_config.clone(),
                    &chain_id,
                    chain_config.clone(),
                    keeper_metrics.clone(),
                    keeper_private_key_option.clone(),
                    chains.clone(),
                    &secret_copy,
                    history.clone(),
                    rpc_metrics.clone(),
                )
                .await;
                match setup_result {
                    Ok(_) => {
                        tracing::info!("Chain {} initialized successfully", chain_id);
                        break;
                    }
                    Err(e) => {
                        tracing::error!("Failed to initialize chain {}: {}", chain_id, e);
                        tokio::time::sleep(tokio::time::Duration::from_secs(15)).await;
                    }
                }
            }
        });
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

    run_api(
        opts.addr,
        chains.clone(),
        metrics_registry.clone(),
        history,
        rx_exit,
    )
    .await?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn setup_chain_and_run_keeper(
    provider_config: ProviderConfig,
    chain_id: &ChainId,
    chain_config: EthereumConfig,
    keeper_metrics: Arc<KeeperMetrics>,
    keeper_private_key_option: Option<String>,
    chains: Arc<RwLock<HashMap<ChainId, ApiBlockChainState>>>,
    secret_copy: &str,
    history: Arc<History>,
    rpc_metrics: Arc<RpcMetrics>,
) -> Result<()> {
    let state = setup_chain_state(
        &provider_config.address,
        secret_copy,
        provider_config.chain_sample_interval,
        chain_id,
        &chain_config,
        rpc_metrics.clone(),
        keeper_metrics.clone(),
    )
    .await?;
    chains.write().await.insert(
        chain_id.clone(),
        ApiBlockChainState::Initialized(state.clone()),
    );
    if let Some(keeper_private_key) = keeper_private_key_option {
        keeper::run_keeper_threads(
            keeper_private_key,
            chain_config,
            state,
            keeper_metrics.clone(),
            history,
            rpc_metrics.clone(),
        )
        .await?;
    }
    Ok(())
}

async fn setup_chain_state(
    provider: &Address,
    secret: &str,
    chain_sample_interval: u64,
    chain_id: &ChainId,
    chain_config: &EthereumConfig,
    rpc_metrics: Arc<RpcMetrics>,
    keeper_metrics: Arc<KeeperMetrics>,
) -> Result<BlockchainState> {
    let contract = Arc::new(InstrumentedPythContract::from_config(
        chain_config,
        chain_id.clone(),
        rpc_metrics,
    )?);
    let network_id: u64 = contract
        .get_network_id()
        .await
        .map_err(|e| anyhow!("Failed to get network id: {}. Chain id: {}", &chain_id, e))?
        .as_u64();
    let mut provider_commitments = chain_config.commitments.clone().unwrap_or_default();
    provider_commitments.sort_by(|c1, c2| {
        c1.original_commitment_sequence_number
            .cmp(&c2.original_commitment_sequence_number)
    });

    let provider_info = contract
        .get_provider_info(*provider)
        .call()
        .await
        .map_err(|e| anyhow!("Failed to get provider info: {}", e))?;
    let latest_metadata = bincode::deserialize::<CommitmentMetadata>(
        &provider_info.commitment_metadata,
    )
    .map_err(|e| {
        anyhow!(
            "Chain: {} - Failed to deserialize commitment metadata: {}",
            &chain_id,
            e
        )
    })?;

    let last_prior_commitment = provider_commitments.last();
    if last_prior_commitment.is_some()
        && last_prior_commitment
            .unwrap()
            .original_commitment_sequence_number
            >= provider_info.original_commitment_sequence_number
    {
        return Err(anyhow!("The current hash chain for chain id {} has configured commitments for sequence numbers greater than the current on-chain sequence number. Are the commitments configured correctly?", &chain_id));
    }

    provider_commitments.push(Commitment {
        seed: latest_metadata.seed,
        chain_length: latest_metadata.chain_length,
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

        let pebble_hash_chain = PebbleHashChain::from_config_async(
            secret,
            chain_id,
            provider,
            &chain_config.contract_addr,
            &commitment.seed,
            commitment.chain_length,
            chain_sample_interval,
        )
        .await
        .map_err(|e| anyhow!("Failed to create hash chain: {}", e))?;
        hash_chains.push(pebble_hash_chain);
    }

    let chain_state = HashChainState::new(offsets, hash_chains)?;

    if chain_state.reveal(provider_info.original_commitment_sequence_number)?
        != provider_info.original_commitment
    {
        return Err(anyhow!("The root of the generated hash chain for chain id {} does not match the commitment. Are the secret and chain length configured correctly?", &chain_id));
    } else {
        tracing::info!("Root of chain id {} matches commitment", &chain_id);
    }

    let monitored_chain_state = MonitoredHashChainState::new(
        Arc::new(chain_state),
        keeper_metrics.clone(),
        chain_id.clone(),
        *provider,
    );

    let state = BlockchainState {
        id: chain_id.clone(),
        state: Arc::new(monitored_chain_state),
        network_id,
        contract,
        provider_address: *provider,
        reveal_delay_blocks: chain_config.reveal_delay_blocks,
        confirmed_block_status: chain_config.confirmed_block_status,
    };
    Ok(state)
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct ChainLabel {
    pub chain_id: String,
}
