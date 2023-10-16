#![allow(clippy::just_underscores_and_digits)]
#![feature(slice_flatten)]

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
use ethereum::register_provider;
use ethereum::request_randomness;
use ethereum::get_request;
use ethers::core::types::Address;

use crate::api::{ApiState, get_random_value};
use crate::state::PebbleHashChain;
use crate::ethereum::provider;

pub mod api;
pub mod config;
pub mod ethereum;
pub mod state;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    match config::Options::parse() {
        config::Options::GetRequest(opts) => get_request(&opts).await,
        config::Options::Run(opts) => run(&opts).await,
        config::Options::RegisterProvider(opts) => register_provider(&opts).await,
        config::Options::RequestRandomness(opts) => request_randomness(&opts).await,
    }
}

async fn run(opts: &RunOptions) -> Result<(), Box<dyn Error>> {
    #[derive(OpenApi)]
    #[openapi(
    paths(
      api::get_random_value,
    ),
    components(
    schemas(
      api::GetRandomValueResponse
    )
    ),
    tags(
    (name = "hermes", description = "Pyth Real-Time Pricing API")
    )
    )]
    struct ApiDoc;

    let contract = Arc::new(provider(&opts.ethereum).await?);
    let provider_addr = opts.provider.parse::<Address>()?;
    let provider_info = contract.get_provider_info(provider_addr).call().await?;

    // Reconstruct the hash chain based on the metadata and check that it matches the on-chain commitment.
    let random: [u8; 32] = provider_info.commitment_metadata;
    let mut chain = PebbleHashChain::from_config(&opts.randomness, random)?;
    if chain.reveal_ith(0)? != provider_info.original_commitment {
        println!("warning: root of chain does not match commitment!");
    } else {
        println!("Root of chain matches commitment");
    }

    let mut state = ApiState { state: Arc::new(chain), contract, provider: provider_addr };

    // Initialize Axum Router. Note the type here is a `Router<State>` due to the use of the
    // `with_state` method which replaces `Body` with `State` in the type signature.
    let app = Router::new();
    let app = app
        .merge(SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi()))
        .route("/api/get_random_value", get(get_random_value))
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
