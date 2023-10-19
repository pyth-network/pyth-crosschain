use {
    self::ws::notify_updates,
    crate::{
        aggregate::AggregationEvent,
        config::RunOptions,
        state::State,
    },
    anyhow::Result,
    axum::{
        extract::Extension,
        middleware::from_fn_with_state,
        routing::get,
        Router,
    },
    ipnet::IpNet,
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

mod doc_examples;
mod metrics_middleware;
mod rest;
mod types;
mod ws;

#[derive(Clone)]
pub struct ApiState {
    pub state:   Arc<State>,
    pub ws:      Arc<ws::WsState>,
    pub metrics: Arc<metrics_middleware::Metrics>,
}

impl ApiState {
    pub fn new(
        state: Arc<State>,
        ws_whitelist: Vec<IpNet>,
        requester_ip_header_name: String,
    ) -> Self {
        Self {
            metrics: Arc::new(metrics_middleware::Metrics::new(state.clone())),
            ws: Arc::new(ws::WsState::new(
                ws_whitelist,
                requester_ip_header_name,
                state.clone(),
            )),
            state,
        }
    }
}

/// This method provides a background service that responds to REST requests
///
/// Currently this is based on Axum due to the simplicity and strong ecosystem support for the
/// packages they are based on (tokio & hyper).
#[tracing::instrument(skip(opts, state, update_rx))]
pub async fn run(
    opts: RunOptions,
    state: Arc<State>,
    mut update_rx: Receiver<AggregationEvent>,
) -> Result<()> {
    tracing::info!(endpoint = %opts.rpc.listen_addr, "Starting RPC Server.");

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

    let state = ApiState::new(
        state,
        opts.rpc.ws_whitelist,
        opts.rpc.requester_ip_header_name,
    );

    // Initialize Axum Router. Note the type here is a `Router<State>` due to the use of the
    // `with_state` method which replaces `Body` with `State` in the type signature.
    let app = Router::new();
    let app = app
        .merge(SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi()))
        .route("/", get(rest::index))
        .route("/api/get_price_feed", get(rest::get_price_feed))
        .route("/api/get_vaa", get(rest::get_vaa))
        .route("/api/get_vaa_ccip", get(rest::get_vaa_ccip))
        .route("/api/latest_price_feeds", get(rest::latest_price_feeds))
        .route("/api/latest_vaas", get(rest::latest_vaas))
        .route("/api/price_feed_ids", get(rest::price_feed_ids))
        .route("/live", get(rest::live))
        .route("/metrics", get(rest::metrics))
        .route("/ready", get(rest::ready))
        .route("/ws", get(ws::ws_route_handler))
        .route_layer(from_fn_with_state(
            state.clone(),
            metrics_middleware::track_metrics,
        ))
        .with_state(state.clone())
        // Permissive CORS layer to allow all origins
        .layer(CorsLayer::permissive())
        // Non-strict mode permits escaped [] in URL parameters. 5 is the allowed depth (also the
        // default value for this parameter).
        .layer(Extension(QsQueryConfig::new(5, false)));

    tokio::spawn(async move {
        while !crate::SHOULD_EXIT.load(Ordering::Acquire) {
            match update_rx.recv().await {
                None => {
                    // When the received message is None it means the channel has been closed. This
                    // should never happen as the channel is never closed. As we can't recover from
                    // this we shut down the application.
                    tracing::error!("Failed to receive update from store.");
                    crate::SHOULD_EXIT.store(true, Ordering::Release);
                    break;
                }
                Some(event) => {
                    notify_updates(state.ws.clone(), event).await;
                }
            }
        }

        tracing::info!("Shutting down websocket updates...")
    });

    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    axum::Server::try_bind(&opts.rpc.listen_addr)?
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
