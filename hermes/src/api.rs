use {
    self::ws::notify_updates,
    crate::store::Store,
    anyhow::Result,
    axum::{
        extract::Extension,
        routing::get,
        Router,
    },
    serde_qs::axum::QsQueryConfig,
    std::sync::Arc,
    tokio::{
        signal,
        sync::mpsc::Receiver,
    },
    tower_http::cors::CorsLayer,
    utoipa::OpenApi,
    utoipa_swagger_ui::SwaggerUi,
};

mod rest;
mod types;
mod ws;

#[derive(Clone)]
pub struct State {
    pub store: Arc<Store>,
    pub ws:    Arc<ws::WsState>,
}

impl State {
    pub fn new(store: Arc<Store>) -> Self {
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
pub async fn run(store: Arc<Store>, mut update_rx: Receiver<()>, rpc_addr: String) -> Result<()> {
    #[derive(OpenApi)]
    #[openapi(
    paths(
      rest::latest_price_feeds,
    ),
    components(
      schemas(types::RpcPriceFeedMetadata, types::RpcPriceFeed, types::PriceIdInput)
    ),
    tags(
      (name = "hermes", description = "Pyth Real-Time Pricing API")
    )
    )]
    struct ApiDoc;

    let state = State::new(store);

    // Initialize Axum Router. Note the type here is a `Router<State>` due to the use of the
    // `with_state` method which replaces `Body` with `State` in the type signature.
    let app = Router::new();
    let app = app
        .merge(SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi()))
        .route("/", get(rest::index))
        .route("/live", get(rest::live))
        .route("/ready", get(rest::ready))
        .route("/ws", get(ws::ws_route_handler))
        .route("/api/latest_price_feeds", get(rest::latest_price_feeds))
        .route("/api/latest_vaas", get(rest::latest_vaas))
        .route("/api/get_price_feed", get(rest::get_price_feed))
        .route("/api/get_vaa", get(rest::get_vaa))
        .route("/api/get_vaa_ccip", get(rest::get_vaa_ccip))
        .route("/api/price_feed_ids", get(rest::price_feed_ids))
        .with_state(state.clone())
        .layer(CorsLayer::permissive()) // Permissive CORS layer to allow all origins
        .layer(Extension(QsQueryConfig::new(5, false))); // non-strict mode permits escaped [] in URL parameters


    // Call dispatch updates to websocket every 1 seconds
    // FIXME use a channel to get updates from the store
    tokio::spawn(async move {
        loop {
            // Panics if the update channel is closed, which should never happen.
            // If it happens we have no way to recover, so we just panic.
            update_rx
                .recv()
                .await
                .expect("state update channel is closed");

            notify_updates(state.ws.clone()).await;
        }
    });

    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    axum::Server::try_bind(&rpc_addr.parse()?)?
        .serve(app.into_make_service())
        .with_graceful_shutdown(async {
            signal::ctrl_c()
                .await
                .expect("Ctrl-c signal handler failed.");
        })
        .await?;

    Ok(())
}
