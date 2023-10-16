use anyhow::anyhow;
use std::error::Error;

use clap::Parser;

use {
    anyhow::Result,
    axum::{
        Router,
        routing::get,
    },
    crate::config::RunOptions,
    std::sync::{
        Arc,
    },
    tower_http::cors::CorsLayer,
    utoipa::OpenApi,
    utoipa_swagger_ui::SwaggerUi,
};
use ethers::core::types::Address;

use crate::api;
use crate::state::{HashChainState, PebbleHashChain};
use crate::ethereum::PythContract;

pub async fn run(opts: &RunOptions) -> Result<(), Box<dyn Error>> {
    #[derive(OpenApi)]
    #[openapi(
    paths(
    crate::api::revelation,
    ),
    components(
    schemas(
    crate::api::GetRandomValueResponse
    )
    ),
    tags(
    (name = "pyth-rng", description = "Pyth Random Number Service")
    )
    )]
    struct ApiDoc;

    let contract = Arc::new(PythContract::from_opts(&opts.ethereum).await?);
    let provider_addr = opts.provider.parse::<Address>()?;
    let provider_info = contract.get_provider_info(provider_addr).call().await?;

    // Reconstruct the hash chain based on the metadata and check that it matches the on-chain commitment.
    // TODO: we should instantiate the state here with multiple hash chains.
    // This approach works fine as long as we haven't rotated the commitment (i.e., all user requests
    // are for the most recent chain).
    let random: [u8; 32] = provider_info.commitment_metadata;
    let mut chain = PebbleHashChain::from_config(&opts.randomness, random)?;
    let chain_state = HashChainState {
        offsets: vec![provider_info.original_commitment_sequence_number.try_into()?],
        hash_chains: vec![chain],
    };

    if chain_state.reveal(provider_info.original_commitment_sequence_number)? != provider_info.original_commitment {
        return Err(anyhow!("The root of the generated hash chain does not match the commitment. Is the secret configured correctly?").into());
    } else {
        println!("Root of chain matches commitment");
    }

    let mut state = api::ApiState { state: Arc::new(chain_state), contract, provider_address: provider_addr };

    // Initialize Axum Router. Note the type here is a `Router<State>` due to the use of the
    // `with_state` method which replaces `Body` with `State` in the type signature.
    let app = Router::new();
    let app = app
        .merge(SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi()))
        .route("/", get(api::index))
        .route("/v1/revelation", get(api::revelation))
        .with_state(state.clone())
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
