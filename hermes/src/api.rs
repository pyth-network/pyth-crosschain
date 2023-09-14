use {
    self::ws::notify_updates,
    crate::{
        config::RunOptions,
        state::State,
    },
    anyhow::Result,
    axum::{
        extract::Extension,
        routing::get,
        Router,
    },
    serde_qs::axum::QsQueryConfig,
    std::sync::{
        atomic::Ordering,
        Arc,
    },
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
pub struct ApiState {
    pub state: Arc<State>,
    pub ws:    Arc<ws::WsState>,
}

impl ApiState {
    pub fn new(state: Arc<State>) -> Self {
        Self {
            state,
            ws: Arc::new(ws::WsState::new()),
        }
    }
}

/// This method provides a background service that responds to REST requests
///
/// Currently this is based on Axum due to the simplicity and strong ecosystem support for the
/// packages they are based on (tokio & hyper).
#[tracing::instrument(skip(opts, state, update_rx))]
pub async fn run(opts: RunOptions, state: Arc<State>, mut update_rx: Receiver<()>) -> Result<()> {
    tracing::info!(endpoint = %opts.api_addr, "Starting RPC Server.");

    #[derive(OpenApi)]
    #[openapi(
        paths(
            rest::get_price_feed,
            rest::get_vaa,
            rest::get_vaa_ccip,
            rest::latest_price_feeds,
            rest::latest_vaas,
            rest::price_feed_ids,
        ),
        components(
            schemas(
                rest::GetVaaCcipInput,
                rest::GetVaaCcipResponse,
                rest::GetVaaResponse,
                types::PriceIdInput,
                types::RpcPrice,
                types::RpcPriceFeed,
                types::RpcPriceFeedMetadata,
                types::RpcPriceIdentifier,
            )
        ),
        tags(
            (name = "hermes", description = "Pyth Real-Time Pricing API")
        )
    )]
    struct ApiDoc;

    let state = ApiState::new(state);

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
        // Permissive CORS layer to allow all origins
        .layer(CorsLayer::permissive())
        // Non-strict mode permits escaped [] in URL parameters. 5 is the allowed depth (also the
        // default value for this parameter).
        .layer(Extension(QsQueryConfig::new(5, false)));

    // Call dispatch updates to websocket every 1 seconds
    // FIXME use a channel to get updates from the store
    tokio::spawn(async move {
        while !crate::SHOULD_EXIT.load(Ordering::Acquire) {
            // Causes a full application shutdown if an error occurs, we can't recover from this so
            // we just quit.
            if update_rx.recv().await.is_none() {
                tracing::error!("Failed to receive update from store.");
                crate::SHOULD_EXIT.store(true, Ordering::Release);
                break;
            }

            notify_updates(state.ws.clone()).await;
        }

        tracing::info!("Shutting down websocket updates...")
    });

    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    axum::Server::try_bind(&opts.api_addr)?
        .serve(app.into_make_service())
        .with_graceful_shutdown(async {
            // Ignore Ctrl+C errors, either way we need to shut down. The main Ctrl+C handler
            // should also have triggered so we will let that one print the shutdown warning.
            let _ = signal::ctrl_c().await;
            crate::SHOULD_EXIT.store(true, Ordering::Release);
        })
        .await?;

    Ok(())
}
