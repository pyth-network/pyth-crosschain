use {
    crate::{
        aggregate::{
            AggregationEvent,
            RequestTime,
        },
        api::{
            rest::{
                verify_price_ids_exist,
                RestError,
            },
            types::{
                BinaryPriceUpdate,
                EncodingType,
                ParsedPriceUpdate,
                PriceIdInput,
                PriceUpdate,
            },
            ApiState,
        },
    },
    anyhow::Result,
    axum::{
        extract::State,
        response::sse::{
            Event,
            KeepAlive,
            Sse,
        },
    },
    futures::Stream,
    pyth_sdk::PriceIdentifier,
    serde::Deserialize,
    serde_qs::axum::QsQuery,
    std::convert::Infallible,
    tokio::sync::broadcast,
    tokio_stream::{
        wrappers::BroadcastStream,
        StreamExt as _,
    },
    utoipa::IntoParams,
};

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct StreamPriceUpdatesQueryParams {
    /// Get the most recent price update for this set of price feed ids.
    ///
    /// This parameter can be provided multiple times to retrieve multiple price updates,
    /// for example see the following query string:
    ///
    /// ```
    /// ?ids[]=a12...&ids[]=b4c...
    /// ```
    #[param(rename = "ids[]")]
    #[param(example = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43")]
    ids: Vec<PriceIdInput>,

    /// If true, include the parsed price update in the `parsed` field of each returned feed.
    #[serde(default)]
    encoding: EncodingType,

    /// If true, include the parsed price update in the `parsed` field of each returned feed.
    #[serde(default = "default_true")]
    parsed: bool,
}

fn default_true() -> bool {
    true
}

#[utoipa::path(
    get,
    path = "/v2/updates/price/stream",
    responses(
        (status = 200, description = "Price updates retrieved successfully", body = PriceUpdate),
        (status = 404, description = "Price ids not found", body = String)
    ),
    params(StreamPriceUpdatesQueryParams)
)]
/// SSE route handler for streaming price updates.
pub async fn price_stream_sse_handler(
    State(state): State<ApiState>,
    QsQuery(params): QsQuery<StreamPriceUpdatesQueryParams>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, RestError> {
    let price_ids: Vec<PriceIdentifier> = params.ids.into_iter().map(|id| id.into()).collect();

    verify_price_ids_exist(&state, &price_ids).await?;

    // Clone the update_tx receiver to listen for new price updates
    let update_rx: broadcast::Receiver<AggregationEvent> = state.update_tx.subscribe();

    // Convert the broadcast receiver into a Stream
    let stream = BroadcastStream::new(update_rx);

    let sse_stream = stream.then(move |message| {
        let state_clone = state.clone(); // Clone again to use inside the async block
        let price_ids_clone = price_ids.clone(); // Clone again for use inside the async block
        async move {
            let event = match message {
                Ok(event) => event,
                Err(e) => {
                    return Ok(Event::default()
                        .event("error")
                        .data(format!("Error receiving update: {:?}", e)))
                }
            };
            match handle_aggregation_event(
                event,
                state_clone,
                price_ids_clone,
                params.encoding,
                params.parsed,
            )
            .await
            {
                Ok(price_update) => Ok(Event::default().json_data(price_update).unwrap()),
                Err(e) => Ok(Event::default()
                    .event("error")
                    .data(format!("Error receiving update: {:?}", e))),
            }
        }
    });

    Ok(Sse::new(sse_stream).keep_alive(KeepAlive::default()))
}

async fn handle_aggregation_event(
    event: AggregationEvent,
    state: ApiState,
    mut price_ids: Vec<PriceIdentifier>,
    encoding: EncodingType,
    parsed: bool,
) -> Result<PriceUpdate> {
    let available_price_feed_ids = crate::aggregate::get_price_feed_ids(&*state.state).await;

    price_ids.retain(|price_feed_id| available_price_feed_ids.contains(price_feed_id));

    let price_feeds_with_update_data = crate::aggregate::get_price_feeds_with_update_data(
        &*state.state,
        &price_ids,
        RequestTime::AtSlot(event.slot()),
    )
    .await?;
    let price_update_data = price_feeds_with_update_data.update_data;
    let encoded_data: Vec<String> = price_update_data
        .into_iter()
        .map(|data| encoding.encode_str(&data))
        .collect();
    let binary_price_update = BinaryPriceUpdate {
        encoding,
        data: encoded_data,
    };
    let parsed_price_updates: Option<Vec<ParsedPriceUpdate>> = if parsed {
        Some(
            price_feeds_with_update_data
                .price_feeds
                .into_iter()
                .map(|price_feed| price_feed.into())
                .collect(),
        )
    } else {
        None
    };


    Ok(PriceUpdate {
        binary: binary_price_update,
        parsed: parsed_price_updates,
    })
}
