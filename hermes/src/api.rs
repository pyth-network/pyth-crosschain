use {
    self::ws::dispatch_updates,
    crate::store::Store,
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
        .route("/ws", get(ws::ws_route_handler))
        .route("/api/latest_price_feeds", get(rest::latest_price_feeds))
        .route("/api/latest_vaas", get(rest::latest_vaas))
        .route("/api/get_vaa", get(rest::get_vaa))
        .route("/api/get_vaa_ccip", get(rest::get_vaa_ccip))
        .route("/api/price_feed_ids", get(rest::price_feed_ids))
        .with_state(state.clone());


    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    tokio::spawn(async move {
        // FIXME handle errors properly
        axum::Server::bind(&rpc_addr.parse().unwrap())
            .serve(app.into_make_service())
            .await
            .unwrap();
    });

    // Call dispatch updates to websocket every 1 seconds
    // FIXME use a channel to get updates from the store
    tokio::spawn(async move {
        loop {
            dispatch_updates(state.store.get_price_feed_ids(), state.clone()).await;
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
    });

    Ok(())
}
