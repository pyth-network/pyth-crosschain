use {
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
    std::sync::Arc,
    tokio::sync::broadcast::Sender,
    tower_http::cors::CorsLayer,
    utoipa::OpenApi,
    utoipa_swagger_ui::SwaggerUi,
};

mod doc_examples;
mod metrics_middleware;
mod rest;
mod sse;
pub mod types;
mod ws;

pub struct ApiState<S = State> {
    pub state:     Arc<S>,
    pub ws:        Arc<ws::WsState>,
    pub metrics:   Arc<metrics_middleware::Metrics>,
    pub update_tx: Sender<AggregationEvent>,
}

/// Manually implement `Clone` as the derive macro will try and slap `Clone` on
/// `State` which should not be Clone.
impl<S> Clone for ApiState<S> {
    fn clone(&self) -> Self {
        Self {
            state:     self.state.clone(),
            ws:        self.ws.clone(),
            metrics:   self.metrics.clone(),
            update_tx: self.update_tx.clone(),
        }
    }
}

impl ApiState<State> {
    pub fn new(
        state: Arc<State>,
        ws_whitelist: Vec<IpNet>,
        requester_ip_header_name: String,
        update_tx: Sender<AggregationEvent>,
    ) -> Self {
        Self {
            metrics: Arc::new(metrics_middleware::Metrics::new(state.clone())),
            ws: Arc::new(ws::WsState::new(
                ws_whitelist,
                requester_ip_header_name,
                state.clone(),
            )),
            state,
            update_tx,
        }
    }
}

#[tracing::instrument(skip(opts, state, update_tx))]
pub async fn spawn(
    opts: RunOptions,
    state: Arc<State>,
    update_tx: Sender<AggregationEvent>,
) -> Result<()> {
    let state = {
        let opts = opts.clone();
        ApiState::new(
            state,
            opts.rpc.ws_whitelist,
            opts.rpc.requester_ip_header_name,
            update_tx,
        )
    };

    run(opts, state.clone()).await
}

/// This method provides a background service that responds to REST requests
///
/// Currently this is based on Axum due to the simplicity and strong ecosystem support for the
/// packages they are based on (tokio & hyper).
#[tracing::instrument(skip(opts, state))]
pub async fn run(opts: RunOptions, state: ApiState) -> Result<()> {
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
            rest::latest_price_updates,
            rest::timestamp_price_updates,
            rest::price_feeds_metadata,
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
                types::EncodingType,
                types::PriceUpdate,
                types::BinaryPriceUpdate,
                types::ParsedPriceUpdate,
                types::RpcPriceFeedMetadataV2,
                types::PriceFeedMetadata,
                types::AssetType
            )
        ),
        tags(
            (name = "hermes", description = "Pyth Real-Time Pricing API")
        )
    )]
    struct ApiDoc;

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
        .route(
            "/v2/updates/price/stream",
            get(sse::price_stream_sse_handler),
        )
        .route("/v2/updates/price/latest", get(rest::latest_price_updates))
        .route(
            "/v2/updates/price/:publish_time",
            get(rest::timestamp_price_updates),
        )
        .route("/v2/price_feeds", get(rest::price_feeds_metadata))
        .route("/live", get(rest::live))
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

    // Binds the axum's server to the configured address and port. This is a blocking call and will
    // not return until the server is shutdown.
    axum::Server::try_bind(&opts.rpc.listen_addr)?
        .serve(app.into_make_service())
        .with_graceful_shutdown(async {
            let _ = crate::EXIT.subscribe().changed().await;
            tracing::info!("Shutting down RPC server...");
        })
        .await?;

    Ok(())
}
