use {
    self::ws::dispatch_updates,
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
    std::sync::Arc,
};

mod rest;
mod types;
mod ws;

#[derive(Clone)]
pub struct State {
    pub store: Store,
    pub ws:    Arc<ws::WsState>,
}

impl State {
    pub fn new(store: Store) -> Self {
        Self {
            store,
            ws: Arc::new(ws::WsState::new()),
        }
    }
}

/// This method provides a background service that responds to REST requests
///
/// Currently this is based on Axum due to the simplicity and strong ecosyjtem support for the
/// packages they are based on (tokio & hyper).
pub async fn spawn(rpc_addr: String, store: Store) -> Result<()> {
    let state = State::new(store);

    // Initialize Axum Router. Note the type here is a `Router<State>` due to the use of the
    // `with_state` method which replaces `Body` with `State` in the type signature.
    let app = Router::new();
    let app = app
        .route("/", get(rest::index))
        .route("/live", get(rest::live))
        .route("/ws", get(ws::ws_route_handler))
        .route("/api/latest_price_feeds", get(rest::latest_price_feeds))
        .route("/api/latest_vaas", get(rest::latest_vaas))
        .route("/api/get_vaa", get(rest::get_vaa))
        .route("/api/get_vaa_ccip", get(rest::get_vaa_ccip))
        .route("/api/price_feed_ids", get(rest::price_feed_ids))
        .with_state(state.clone());

    // Listen in the background for new VAA's from the Wormhole RPC.
    tokio::spawn(async move {
        loop {
            if let Ok(observation) = OBSERVATIONS.1.lock().unwrap().recv() {
                match state.store.store_update(Update::Vaa(observation)) {
                    Ok(updated_feed_ids) => {
                        tokio::spawn(dispatch_updates(updated_feed_ids, state.clone()));
                    }
                    Err(e) => log::error!("Failed to process VAA: {:?}", e),
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
