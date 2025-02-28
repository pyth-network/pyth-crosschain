use {
    crate::{
        api::{self, BlockchainState, ChainId},
        chain::ethereum::InstrumentedPythContract,
        config::{Config, EthereumConfig, RunOptions},
        keeper::{self, keeper_metrics::KeeperMetrics},
    },
    anyhow::{anyhow, Error, Result},
    axum::Router,
    ethers::{
        middleware::Middleware,
        types::{Address, BlockNumber},
    },
    fortuna::eth_utils::traced_client::{RpcMetrics, TracedClient},
    futures::future::join_all,
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{family::Family, gauge::Gauge},
        registry::Registry,
    },
    std::{
        collections::HashMap,
        net::SocketAddr,
        sync::Arc,
        time::{Duration, SystemTime, UNIX_EPOCH},
    },
    tokio::{
        spawn,
        sync::{watch, RwLock},
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
    crate::api::price_update,
    crate::api::chain_ids,
    ),
    components(
    schemas(
    crate::api::GetPriceUpdateResponse,
    crate::api::PriceUpdateData,
    crate::api::ResponseFormat,
    )
    ),
    tags(
    (name = "argus", description = "Price update service for the Pyth Pulse protocol")
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
    rpc_metrics: Arc<RpcMetrics>,
    hermes_base_url: String,
) -> Result<()> {
    let mut handles = Vec::new();
    let keeper_metrics: Arc<KeeperMetrics> = Arc::new({
        let chain_labels: Vec<(String, Address)> = chains
            .iter()
            .map(|(id, state)| (id.clone(), state.provider_address))
            .collect();
        KeeperMetrics::new(metrics_registry.clone(), chain_labels).await
    });
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
            keeper_metrics.clone(),
            rpc_metrics.clone(),
            hermes_base_url.clone(),
        )));
    }

    Ok(())
}

pub async fn run(opts: &RunOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
    let (tx_exit, rx_exit) = watch::channel(false);
    let metrics_registry = Arc::new(RwLock::new(Registry::default()));
    let rpc_metrics = Arc::new(RpcMetrics::new(metrics_registry.clone()).await);

    // Store the hermes base URL from the command-line argument
    let hermes_base_url = opts.hermes_base_url.clone();

    let mut tasks = Vec::new();
    for (chain_id, chain_config) in config.chains.clone() {
        let rpc_metrics = rpc_metrics.clone();
        tasks.push(spawn(async move {
            let state = setup_chain_state(
                &config.provider.address,
                &chain_id,
                &chain_config,
                rpc_metrics,
            )
            .await;

            (chain_id, state)
        }));
    }
    let states = join_all(tasks).await;

    let mut chains: HashMap<ChainId, BlockchainState> = HashMap::new();
    for result in states {
        let (chain_id, state) = result?;

        match state {
            Ok(state) => {
                chains.insert(chain_id.clone(), state);
            }
            Err(e) => {
                tracing::error!("Failed to setup {} {}", chain_id, e);
            }
        }
    }
    if chains.is_empty() {
        return Err(anyhow!("No chains were successfully setup"));
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

    if let Some(keeper_private_key) = config.keeper.private_key.load()? {
        spawn(run_keeper(
            chains.clone(),
            config.clone(),
            keeper_private_key,
            metrics_registry.clone(),
            rpc_metrics.clone(),
            hermes_base_url.clone(),
        ));
    } else {
        tracing::info!("Not starting keeper service: no keeper private key specified. Please add one to the config if you would like to run the keeper service.")
    }

    // Spawn a thread to track latest block lag. This helps us know if the rpc is up and updated with the latest block.
    spawn(track_block_timestamp_lag(
        config,
        metrics_registry.clone(),
        rpc_metrics.clone(),
    ));

    run_api(opts.addr, chains, metrics_registry, rx_exit).await?;

    Ok(())
}

async fn setup_chain_state(
    provider: &Address,
    chain_id: &ChainId,
    chain_config: &EthereumConfig,
    rpc_metrics: Arc<RpcMetrics>,
) -> Result<BlockchainState> {
    let contract = Arc::new(InstrumentedPythContract::from_config(
        chain_config,
        chain_id.clone(),
        rpc_metrics,
    )?);

    // Verify the provider is registered
    let provider_info = contract.get_provider_info(*provider).call().await?;
    if !provider_info.is_registered {
        return Err(anyhow!(
            "Provider {} is not registered on chain {}",
            provider,
            chain_id
        ));
    }

    tracing::info!("Provider {} is registered on chain {}", provider, chain_id);

    let state = BlockchainState {
        id: chain_id.clone(),
        contract,
        provider_address: *provider,
        confirmed_block_status: chain_config.confirmed_block_status,
    };
    Ok(state)
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
pub struct ChainLabel {
    pub chain_id: String,
}

#[tracing::instrument(name = "block_timestamp_lag", skip_all, fields(chain_id = chain_id))]
pub async fn check_block_timestamp_lag(
    chain_id: String,
    chain_config: EthereumConfig,
    metrics: Family<ChainLabel, Gauge>,
    rpc_metrics: Arc<RpcMetrics>,
) {
    let provider =
        match TracedClient::new(chain_id.clone(), &chain_config.geth_rpc_addr, rpc_metrics) {
            Ok(r) => r,
            Err(e) => {
                tracing::error!("Failed to create provider for chain id - {:?}", e);
                return;
            }
        };

    const INF_LAG: i64 = 1000000; // value that definitely triggers an alert
    let lag = match provider.get_block(BlockNumber::Latest).await {
        Ok(block) => match block {
            Some(block) => {
                let block_timestamp = block.timestamp;
                let server_timestamp = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                let lag: i64 = (server_timestamp as i64) - (block_timestamp.as_u64() as i64);
                lag
            }
            None => {
                tracing::error!("Block is None");
                INF_LAG
            }
        },
        Err(e) => {
            tracing::error!("Failed to get block - {:?}", e);
            INF_LAG
        }
    };
    metrics
        .get_or_create(&ChainLabel {
            chain_id: chain_id.clone(),
        })
        .set(lag);
}

/// Tracks the difference between the server timestamp and the latest block timestamp for each chain
pub async fn track_block_timestamp_lag(
    config: Config,
    metrics_registry: Arc<RwLock<Registry>>,
    rpc_metrics: Arc<RpcMetrics>,
) {
    let metrics = Family::<ChainLabel, Gauge>::default();
    metrics_registry.write().await.register(
        "block_timestamp_lag",
        "The difference between server timestamp and latest block timestamp",
        metrics.clone(),
    );
    loop {
        for (chain_id, chain_config) in &config.chains {
            spawn(check_block_timestamp_lag(
                chain_id.clone(),
                chain_config.clone(),
                metrics.clone(),
                rpc_metrics.clone(),
            ));
        }

        time::sleep(TRACK_INTERVAL).await;
    }
}
