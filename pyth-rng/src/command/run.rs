use {
    crate::{
        api,
        config::{
            Config,
            RunOptions,
        },
        ethereum::PythContract,
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
        routing::get,
        Router,
    },
    std::{
        collections::HashMap,
        error::Error,
        sync::Arc,
    },
    tower_http::cors::CorsLayer,
    utoipa::OpenApi,
    utoipa_swagger_ui::SwaggerUi,
};

pub async fn run(opts: &RunOptions) -> Result<(), Box<dyn Error>> {
    #[derive(OpenApi)]
    #[openapi(
    paths(
    crate::api::revelation,
    crate::api::chain_ids,
    ),
    components(
    schemas(
    crate::api::GetRandomValueResponse,
    )
    ),
    tags(
    (name = "pyth-rng", description = "Pyth Random Number Service")
    )
    )]
    struct ApiDoc;

    let config = Config::load(&opts.config.config)?;

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
        let random: [u8; 32] = provider_info.commitment_metadata;
        let hash_chain = PebbleHashChain::from_config(&opts.randomness, &chain_id, random)?;
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
            println!("Root of chain id {} matches commitment", &chain_id);
        }

        let state = api::BlockchainState {
            state: Arc::new(chain_state),
            contract,
            provider_address: opts.provider,
        };

        chains.insert(chain_id.clone(), state);
    }

    let api_state = api::ApiState {
        chains: Arc::new(chains),
    };

    // Initialize Axum Router. Note the type here is a `Router<State>` due to the use of the
    // `with_state` method which replaces `Body` with `State` in the type signature.
    let app = Router::new();
    let app = app
        .merge(SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi()))
        .route("/", get(api::index))
        .route("/v1/chains", get(api::chain_ids))
        .route(
            "/v1/chains/:chain_id/revelations/:sequence",
            get(api::revelation),
        )
        .with_state(api_state)
        // Permissive CORS layer to allow all origins
        .layer(CorsLayer::permissive());


    println!("Starting server on: {:?}", &opts.addr);
    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    axum::Server::try_bind(&opts.addr)?
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
