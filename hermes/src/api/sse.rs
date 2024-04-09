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
    futures::{
        future::Either,
        stream,
        Stream,
    },
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

    match verify_price_ids_exist(&state, &price_ids).await {
        Ok(_) => {
            // Clone the update_tx receiver to listen for new price updates
            let update_rx: broadcast::Receiver<AggregationEvent> = state.update_tx.subscribe();

            // Convert the broadcast receiver into a Stream
            let stream = BroadcastStream::new(update_rx);

            let sse_stream = stream.then(move |message| {
                let state_clone = state.clone(); // Clone again to use inside the async block
                let mut price_ids_clone = price_ids.clone(); // Clone again for use inside the async block
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
                                        // The error can only happen when a price feed was available
                                        // and is no longer there as we check the price feed ids upon
                                        // subscription. In this case we just remove the non-existing
                                        // price feed from the list and will keep sending updates for
                                        // the rest.

                                        let available_price_feed_ids =
                                            crate::aggregate::get_price_feed_ids(
                                                &*state_clone.state,
                                            )
                                            .await;

                                        price_ids_clone.retain(|price_feed_id| {
                                            available_price_feed_ids.contains(price_feed_id)
                                        });
                                        let error_message = format!(
                                            "Failed to retrieve price feeds {:?} with update data: {:?}. These feeds are no longer available, will be removed, and updates will continue for the remaining feeds.",
                                            price_ids_clone, e
                                        );
                                        tracing::warn!(error_message);
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
                            let parsed_price_updates: Option<Vec<ParsedPriceUpdate>> =
                                if params.parsed {
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

                            Ok(Event::default().json_data(compressed_price_update).unwrap())
                        }
                        Err(e) => {
                            let error_message = format!("Error receiving update: {:?}", e);
                            Ok(Event::default().json_data(error_message).unwrap())
                        }
                    }
                }
            });
            Sse::new(Either::Left(sse_stream)).keep_alive(KeepAlive::default())
        }
        Err(e) => {
            // Create a stream that immediately returns an error event and then closes
            let error_message = format!("Price IDs not found: {:?}", e);
            let error_event = Event::default().data(error_message);
            let error_stream = stream::once(async { Ok(error_event) });

            Sse::new(Either::Right(error_stream)).keep_alive(KeepAlive::default())
        }
    }
}
