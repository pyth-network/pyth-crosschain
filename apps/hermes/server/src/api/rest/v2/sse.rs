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
    tokio::{
        sync::{broadcast, mpsc},
        time::Instant,
    },
    tokio_stream::{
        wrappers::{errors::BroadcastStreamRecvError, BroadcastStream, ReceiverStream},
        StreamExt as _,
    },
    utoipa::IntoParams,
};

// Constants
const MAX_CONNECTION_DURATION: Duration = Duration::from_secs(24 * 60 * 60); // 24 hours

/// How long a single SSE event may wait to be accepted by the client before the
/// client is treated as a slow consumer and the connection is closed. This
/// bounds how long the producer task may park while trying to hand an event to a
/// client that has stopped draining the channel.
const SSE_SEND_TIMEOUT: Duration = Duration::from_secs(10);

/// Bounded buffer of pending SSE events between the producer task and the
/// response body. Caps per-connection buffering; once it stays full for
/// [`SSE_SEND_TIMEOUT`] the client is treated as a slow consumer.
const SSE_CHANNEL_CAPACITY: usize = 16;

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
/// It is also closed if the client cannot keep up with the update stream (a "slow
/// consumer"): a final `error` event describing the reason is sent on a best-effort
/// basis before the stream ends. Clients should implement reconnection logic to
/// maintain continuous price updates.
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

    // Subscribe to price updates and wrap the broadcast receiver in a Stream.
    let update_rx: broadcast::Receiver<AggregationEvent> = Aggregates::subscribe(&*state.state);
    let mut stream = BroadcastStream::new(update_rx);

    // Copy out the request options so the producer task can own them.
    let encoding = params.encoding;
    let parsed = params.parsed;
    let benchmarks_only = params.benchmarks_only;
    let allow_unordered = params.allow_unordered;

    // Bounded channel between the producer task and the response body. Its
    // capacity caps how many events we buffer for a connection.
    let (tx, rx) = mpsc::channel::<Result<Event, Infallible>>(SSE_CHANNEL_CAPACITY);

    // Drive the broadcast stream from an independent task rather than from the
    // response body itself. An axum/hyper response body is only polled while the
    // socket can accept more bytes, so a client that stops reading would freeze a
    // body-driven stream — and any deadline or slow-consumer logic inside it —
    // pinning the connection (its task and broadcast receiver) until the OS TCP
    // timeout, which is the source of the unbounded memory growth. Producing
    // events in a spawned task that forwards into the bounded channel keeps both
    // the 24h deadline and slow-consumer detection working regardless of whether
    // the client is reading: the channel fills, the send below times out, and we
    // tear the connection down, dropping the broadcast receiver promptly.
    tokio::spawn(async move {
        // Hard wall-clock deadline, driven by the runtime independently of the body.
        let deadline = tokio::time::sleep_until(Instant::now() + MAX_CONNECTION_DURATION);
        tokio::pin!(deadline);

        loop {
            let event = tokio::select! {
                biased;
                // The response body (and thus the receiver) was dropped: the
                // client disconnected, so there is nothing left to stream.
                _ = tx.closed() => break,
                // 24h hard deadline reached.
                _ = &mut deadline => {
                    let _ = tx.try_send(Ok(Event::default()
                        .event("error")
                        .data("Connection timeout reached (24h)")));
                    state.metrics.sse_connection_timeouts.inc();
                    break;
                }
                maybe_message = stream.next() => {
                    match maybe_message {
                        // Broadcast sender dropped; nothing left to stream.
                        None => break,
                        // The broadcast channel dropped `skipped` updates for this
                        // receiver because the task itself fell behind (its sends to
                        // a slow client backed up). Treat it as a slow consumer.
                        Some(Err(BroadcastStreamRecvError::Lagged(skipped))) => {
                            tracing::info!(
                                skipped,
                                "SSE client is a slow consumer (broadcast lag); closing connection.",
                            );
                            state.metrics.sse_slow_consumer_disconnects.inc();
                            let _ = tx.try_send(Ok(Event::default().event("error").data(format!(
                                "Slow consumer: dropped {skipped} updates. Closing connection.",
                            ))));
                            break;
                        }
                        Some(Ok(event)) => {
                            match handle_aggregation_event(
                                event,
                                state.clone(),
                                price_ids.clone(),
                                encoding,
                                parsed,
                                benchmarks_only,
                                allow_unordered,
                            )
                            .await
                            {
                                Ok(Some(update)) => {
                                    Event::default().json_data(update).unwrap_or_else(error_event)
                                }
                                // No update for the subscribed feeds at this slot.
                                Ok(None) => continue,
                                Err(e) => error_event(e),
                            }
                        }
                    }
                }
            };

            // Forward the event to the client, bounded by SSE_SEND_TIMEOUT. If the
            // client stops draining the channel it fills up and this send blocks;
            // once it exceeds the timeout the client is a slow consumer and we close.
            match tokio::time::timeout(SSE_SEND_TIMEOUT, tx.send(Ok(event))).await {
                Ok(Ok(())) => {}
                // Receiver dropped: client disconnected.
                Ok(Err(_)) => break,
                Err(_) => {
                    tracing::info!("SSE client is a slow consumer (send timeout); closing connection.");
                    state.metrics.sse_slow_consumer_disconnects.inc();
                    break;
                }
            }
        }
    });

    Ok(Sse::new(ReceiverStream::new(rx)).keep_alive(KeepAlive::default()))
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
                .is_some_and(|prev_time| prev_time != price_feed.price.publish_time)
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

    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    for pu in &parsed_price_updates {
        if let Some(receive_time) = pu.metadata.proof_available_time {
            let latency = now_secs - (receive_time as f64);
            state
                .metrics
                .sse_broadcast_latency
                .observe(latency.max(0.0));
        }
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
        .data(format!("Error receiving update: {e:?}"))
}
