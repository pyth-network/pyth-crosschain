use {
    crate::{
        api::{
            rest::{validate_price_ids, RestError},
            types::{
                BinaryUpdate, EncodingType, ParsedPriceUpdate, PriceIdInput, PriceUpdate,
                RpcPriceIdentifier,
            },
            ApiState,
        },
        state::aggregate::{Aggregates, AggregationEvent, RequestTime},
    },
    anyhow::Result,
    axum::{
        extract::State,
        response::sse::{Event, KeepAlive, Sse},
    },
    futures::Stream,
    pyth_sdk::PriceIdentifier,
    serde::Deserialize,
    serde_qs::axum::QsQuery,
    std::{convert::Infallible, time::Duration},
    tokio::{sync::broadcast, time::Instant},
    tokio_stream::{wrappers::BroadcastStream, StreamExt as _},
    utoipa::IntoParams,
};

// Constants
const MAX_CONNECTION_DURATION: Duration = Duration::from_secs(24 * 60 * 60); // 24 hours

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

    /// Optional encoding type. If true, return the price update in the encoding specified by the encoding parameter. Default is `hex`.
    #[serde(default)]
    encoding: EncodingType,

    /// If true, include the parsed price update in the `parsed` field of each returned feed. Default is `true`.
    #[serde(default = "default_true")]
    parsed: bool,

    /// If true, allows unordered price updates to be included in the stream.
    #[serde(default)]
    allow_unordered: bool,

    /// If true, only include benchmark prices that are the initial price updates at a given timestamp (i.e., prevPubTime != pubTime).
    #[serde(default)]
    benchmarks_only: bool,

    /// If true, invalid price IDs in the `ids` parameter are ignored. Only applicable to the v2 APIs. Default is `false`.
    #[serde(default)]
    ignore_invalid_price_ids: bool,
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
///
/// The connection will automatically close after 24 hours to prevent resource leaks.
/// Clients should implement reconnection logic to maintain continuous price updates.
pub async fn price_stream_sse_handler<S>(
    State(state): State<ApiState<S>>,
    QsQuery(params): QsQuery<StreamPriceUpdatesQueryParams>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, RestError>
where
    S: Aggregates,
    S: Send + Sync + 'static,
{
    let price_id_inputs: Vec<PriceIdentifier> = params.ids.into_iter().map(Into::into).collect();
    let price_ids: Vec<PriceIdentifier> =
        validate_price_ids(&state, &price_id_inputs, params.ignore_invalid_price_ids).await?;

    // Clone the update_tx receiver to listen for new price updates
    let update_rx: broadcast::Receiver<AggregationEvent> = Aggregates::subscribe(&*state.state);

    // Convert the broadcast receiver into a Stream
    let stream = BroadcastStream::new(update_rx);

    // Set connection start time
    let start_time = Instant::now();

    let sse_stream = stream
        .take_while(move |_| start_time.elapsed() < MAX_CONNECTION_DURATION)
        .then(move |message| {
            let state_clone = state.clone(); // Clone again to use inside the async block
            let price_ids_clone = price_ids.clone(); // Clone again for use inside the async block
            async move {
                match message {
                    Ok(event) => {
                        match handle_aggregation_event(
                            event,
                            state_clone,
                            price_ids_clone,
                            params.encoding,
                            params.parsed,
                            params.benchmarks_only,
                            params.allow_unordered,
                        )
                        .await
                        {
                            Ok(Some(update)) => Some(Ok(Event::default()
                                .json_data(update)
                                .unwrap_or_else(error_event))),
                            Ok(None) => None,
                            Err(e) => Some(Ok(error_event(e))),
                        }
                    }
                    Err(e) => Some(Ok(error_event(e))),
                }
            }
        })
        .filter_map(|x| x)
        .chain(futures::stream::once(async {
            Ok(Event::default()
                .event("error")
                .data("Connection timeout reached (24h)"))
        }));

    Ok(Sse::new(sse_stream).keep_alive(KeepAlive::default()))
}

async fn handle_aggregation_event<S>(
    event: AggregationEvent,
    state: ApiState<S>,
    mut price_ids: Vec<PriceIdentifier>,
    encoding: EncodingType,
    parsed: bool,
    benchmarks_only: bool,
    allow_unordered: bool,
) -> Result<Option<PriceUpdate>>
where
    S: Aggregates,
{
    // Handle out-of-order events
    if let AggregationEvent::OutOfOrder { .. } = event {
        if !allow_unordered {
            return Ok(None);
        }
    }

    // We check for available price feed ids to ensure that the price feed ids provided exists since price feeds can be removed.
    let available_price_feed_ids = Aggregates::get_price_feed_ids(&*state.state).await;

    price_ids.retain(|price_feed_id| available_price_feed_ids.contains(price_feed_id));

    let mut price_feeds_with_update_data = Aggregates::get_price_feeds_with_update_data(
        &*state.state,
        &price_ids,
        RequestTime::AtSlot(event.slot()),
    )
    .await?;

    let mut parsed_price_updates: Vec<ParsedPriceUpdate> = price_feeds_with_update_data
        .price_feeds
        .into_iter()
        .map(|price_feed| price_feed.into())
        .collect();

    if benchmarks_only {
        // Remove those with metadata.prev_publish_time != price.publish_time from parsed_price_updates
        parsed_price_updates.retain(|price_feed| {
            price_feed
                .metadata
                .prev_publish_time
                .map_or(false, |prev_time| {
                    prev_time != price_feed.price.publish_time
                })
        });
        // Retain price id in price_ids that are in parsed_price_updates
        price_ids.retain(|price_id| {
            parsed_price_updates
                .iter()
                .any(|price_feed| price_feed.id == RpcPriceIdentifier::from(*price_id))
        });
        price_feeds_with_update_data = Aggregates::get_price_feeds_with_update_data(
            &*state.state,
            &price_ids,
            RequestTime::AtSlot(event.slot()),
        )
        .await?;
    }

    // Check if price_ids is empty after filtering and return None if it is
    if price_ids.is_empty() {
        return Ok(None);
    }

    let price_update_data = price_feeds_with_update_data.update_data;
    let encoded_data: Vec<String> = price_update_data
        .into_iter()
        .map(|data| encoding.encode_str(&data))
        .collect();
    let binary_price_update = BinaryUpdate {
        encoding,
        data: encoded_data,
    };

    Ok(Some(PriceUpdate {
        binary: binary_price_update,
        parsed: if parsed {
            Some(parsed_price_updates)
        } else {
            None
        },
    }))
}

fn error_event<E: std::fmt::Debug>(e: E) -> Event {
    Event::default()
        .event("error")
        .data(format!("Error receiving update: {:?}", e))
}
