use {
    crate::{
        network::p2p::OBSERVATIONS,
        store::{
            Store,
            Update,
        },
    },
    anyhow::Result,
    axum::{
        routing::get,
        Router,
    },
};

mod rest;

#[derive(Clone)]
pub struct State {
    pub proof_store: Store,
}

impl State {
    pub fn new(proof_store: Store) -> Self {
        Self { proof_store }
    }
}

/// This method provides a background service that responds to REST requests
///
/// Currently this is based on Axum due to the simplicity and strong ecosystem support for the
/// packages they are based on (tokio & hyper).
pub async fn spawn(rpc_addr: String, store: Store) -> Result<()> {
    let state = State::new(store);

    // Initialize Axum Router. Note the type here is a `Router<State>` due to the use of the
    // `with_state` method which replaces `Body` with `State` in the type signature.
    let app = Router::new();
    let app = app
        .route("/", get(rest::index))
        .route("/live", get(rest::live))
        .route("/latest_price_feeds", get(rest::latest_price_feeds))
        .route("/latest_vaas", get(rest::latest_vaas))
        .with_state(state.clone());

    // Listen in the background for new VAA's from the Wormhole RPC.
    tokio::spawn(async move {
        loop {
            if let Ok(observation) = OBSERVATIONS.1.lock().unwrap().recv() {
                if let Err(e) = state.proof_store.store_update(Update::Vaa(observation)) {
                    log::error!("Failed to process VAA: {:?}", e);
                }
            }
        }
    });

    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    axum::Server::bind(&rpc_addr.parse()?)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
