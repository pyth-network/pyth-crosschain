use {
    crate::{
        aggregate::{
            AggregationEvent,
            RequestTime,
        },
        api::{
            rest::verify_price_ids_exist,
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
params(
StreamPriceUpdatesQueryParams,
)
)]
/// SSE route handler for streaming price updates.
pub async fn price_stream_sse_handler(
    State(state): State<ApiState>,
    QsQuery(params): QsQuery<StreamPriceUpdatesQueryParams>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let price_ids: Vec<PriceIdentifier> = params.ids.into_iter().map(|id| id.into()).collect();

    // Assuming verify_price_ids_exist returns a Result<(), SomeErrorType>
    match verify_price_ids_exist(&state, &price_ids).await {
        Ok(_) => {}
        Err(_) => {}
    }
    // Clone the update_tx receiver to listen for new price updates
    let update_rx: broadcast::Receiver<AggregationEvent> = state.update_tx.subscribe();

    // Convert the broadcast receiver into a Stream
    let stream = BroadcastStream::new(update_rx);

    let sse_stream = stream.then(move |message| {
        let state_clone = state.clone(); // Clone again to use inside the async block
        let price_ids_clone = price_ids.clone(); // Clone again for use inside the async block
        async move {
            match message {
                Ok(event) => {
                    let price_feeds_with_update_data =
                        match crate::aggregate::get_price_feeds_with_update_data(
                            &*state_clone.state,
                            &price_ids_clone,
                            RequestTime::AtSlot(event.slot()),
                        )
                        .await
                        {
                            Ok(data) => data,
                            Err(e) => {
                                tracing::warn!(
                                    "Error getting price feeds {:?} with update data: {:?}",
                                    price_ids_clone,
                                    e
                                );
                                let error_message = format!(
                                    "Error getting price feeds {:?} with update data: {:?}",
                                    price_ids_clone, e
                                );
                                return Ok(Event::default().data(error_message));
                            }
                        };
                    let price_update_data = price_feeds_with_update_data.update_data;
                    let encoded_data: Vec<String> = price_update_data
                        .into_iter()
                        .map(|data| params.encoding.encode_str(&data))
                        .collect();
                    let binary_price_update = BinaryPriceUpdate {
                        encoding: params.encoding,
                        data:     encoded_data,
                    };
                    let parsed_price_updates: Option<Vec<ParsedPriceUpdate>> = if params.parsed {
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
                    let compressed_price_update = PriceUpdate {
                        binary: binary_price_update,
                        parsed: parsed_price_updates,
                    };

                    let json_string = serde_json::to_string(&compressed_price_update)
                        .unwrap_or_else(|e| {
                            tracing::error!("Failed to serialize to JSON: {:?}", e);
                            let error_message = format!("Failed to serialize to JSON: {:?}", e);
                            error_message
                        });


                    Ok(Event::default().data(json_string))
                }
                Err(e) => {
                    tracing::error!("Error receiving update: {:?}", e);
                    let error_str = e.to_string();
                    Ok(Event::default().data(error_str))
                }
            }
        }
    });

    Sse::new(sse_stream).keep_alive(KeepAlive::default())
}
