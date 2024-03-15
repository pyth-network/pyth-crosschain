use {
    crate::{
        api,
        chain::{
            self,
            ethereum::PythContract,
            reader::{
                BlockNumber,
                BlockStatus,
            },
        },
        command::register_provider::CommitmentMetadata,
        config::{
            Config,
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
    axum::Router,
    ethers::{
        etherscan::blocks,
        providers::{
            Http,
            Middleware,
            Provider,
            StreamExt,
        },
    },
    futures::future::join_all,
    std::{
        collections::HashMap,
        net::SocketAddr,
        sync::{
            atomic::{
                AtomicBool,
                Ordering,
            },
            Arc,
        },
        thread,
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

struct BlockRange {
    from: BlockNumber,
    to:   BlockNumber,
}

pub async fn run_api(
    socket_addr: SocketAddr,
    chains: HashMap<String, api::BlockchainState>,
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
        .await?;

    Ok(())
}

pub async fn run_keeper(
    chains: HashMap<String, api::BlockchainState>,
    config: Config,
) -> Result<()> {
    let handles = Vec::new();
    for (chain_id, chain_config) in chains {
        let chain_eth_config = config.chains.get(&chain_id).unwrap();

        handles.push(spawn(async {
            let latest_safe_block = chain_config
                .contract
                .get_block_number(chain_config.confirmed_block_status)
                .await?
                - chain_config.reveal_delay_blocks;

            let handle_backlog = spawn(async {
                // TODO: add to config
                let backlog_blocks: u64 = 10_000;
                let blocks_at_a_time = 100;

                let from_block = latest_safe_block - backlog_blocks;
                let last_block = latest_safe_block;

                while from_block < last_block {
                    let mut to_block = from_block + blocks_at_a_time;
                    if to_block > last_block {
                        to_block = last_block;
                    }

                    // let events = chain_config
                    //     .contract
                    //     .get_request_with_callback_events(from_block, to_block)
                    //     .await?;
                    println!("from_block: {}, to_block: {}", from_block, to_block);

                    from_block = to_block + 1;

                    // wait for 5 seconds before processing the next lot of blocks
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                }

                Ok(())
            });

            let (tx, mut rx) = mpsc::channel::<BlockRange>(1000);

            let handle_watch_blocks = spawn(async {
                let last_safe_block = latest_safe_block;

                // for a http provider it only supports streaming
                let provider = Provider::<Http>::try_from(chain_eth_config.geth_rpc_addr)?;
                let mut stream = provider.watch_blocks().await?;

                while let Some(block) = stream.next().await {
                    let latest_safe_block = chain_config
                        .contract
                        .get_block_number(chain_config.confirmed_block_status)
                        .await?
                        - chain_config.reveal_delay_blocks;

                    if latest_safe_block > last_safe_block {
                        tx.send(BlockRange {
                            from: last_safe_block,
                            to:   latest_safe_block,
                        })
                        .await?;

                        last_safe_block = latest_safe_block;
                    }
                }

                Ok(())
            });

            let handle_events = spawn(async {
                while let Some(block_range) = rx.recv().await {
                    // TODO: add to config
                    let blocks_at_a_time = 100;
                    let mut from_block = block_range.from;

                    while from_block < block_range.to {
                        let mut to_block = from_block + blocks_at_a_time;
                        if to_block > block_range.to {
                            to_block = block_range.to;
                        }

                        // let events = chain_config
                        //     .contract
                        //     .get_request_with_callback_events(from_block, to_block)
                        //     .await?;

                        // // TODO: handle events;
                        // // Probably can have another thread which will handle these events;
                        // println!("events: {:?}", events);

                        println!("from_block: {}, to_block: {}", from_block, to_block);

                        from_block = to_block + 1;
                    }
                }

                Ok(())
            });

            let tasks = join_all([handle_backlog, handle_watch_blocks, handle_events]).await;
            for task in tasks {
                task??;
                // TODO: condition to retry on error
            }

            Ok(())
        }));
    }

    let tasks = join_all(handles).await;
    for task in tasks {
        task??;
    }

    Ok(())
}

pub async fn run(opts: &RunOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;
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

    let chains_clone = chains.clone();

    // TODO: use tokio watch to gracefully exit

    let tasks = join_all([
        spawn(run_api(opts.addr.clone(), chains)),
        spawn(run_keeper(chains_clone, config)),
    ])
    .await;

    for task in tasks {
        task??;
    }

    Ok(())
}
