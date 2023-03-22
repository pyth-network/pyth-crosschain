use {
    crate::{
        db::Db,
        network::p2p::OBSERVATIONS,
        proof_store::{
            ProofStore,
            ProofUpdate,
        },
        Vaa,
    },
    anyhow::{
        anyhow,
        Result,
    },
    axum::{
        routing::get,
        Router,
    },
    dashmap::DashMap,
    pyth_sdk::PriceFeed,
    std::{
        sync::Arc,
        time::Duration,
    },
    tokio::sync::RwLock,
    wormhole::VAA,
};

mod rest;

#[derive(Clone)]
pub struct State<D: Db> {
    pub proof_store: ProofStore<D>,
}

impl<D: Db> State<D> {
    pub fn new(proof_store: ProofStore<D>) -> Self {
        Self { proof_store }
    }
}

/// This method provides a background service that responds to REST requests
///
/// Currently this is based on Axum due to the simplicity and strong ecosystem support for the
/// packages they are based on (tokio & hyper).
pub async fn spawn(rpc_addr: String, db: impl Db + 'static) -> Result<()> {
    let mut state = State::new(ProofStore::new(db));

    // Initialize Axum Router. Note the type here is a `Router<State>` due to the use of the
    // `with_state` method which replaces `Body` with `State` in the type signature.
    let app = Router::new();
    let app = app
        .route("/", get(rest::index))
        .route("/live", get(rest::live))
        .route("/latest_vaas", get(rest::latest_vaas))
        .with_state(state.clone());

    // Listen in the background for new VAA's from the Wormhole RPC.
    tokio::spawn(async move {
        loop {
            if let Ok(observation) = OBSERVATIONS.1.lock().unwrap().recv() {
                if let Ok(vaa) = VAA::from_bytes(observation.clone()) {
                    // Add the VAA to the cache.
                    //
                    // TODO: We haven't deserialized the VAA yet, so we don't know the Price ID. We
                    // should this but for this PR we just use a placeholder.
                    // cfg.vaa_cache.add("UnknownID".to_string(), 0, vaa).unwrap();
                    state.proof_store.process_update(ProofUpdate::Vaa(vaa));
                } else {
                    log::error!("Failed to deserialize VAA from bytes: {:?}", observation);
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
