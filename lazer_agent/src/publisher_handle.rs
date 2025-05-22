use std::{net::SocketAddr, time::Duration};

use anyhow::bail;
use futures_util::io::{BufReader, BufWriter};
use hyper_util::rt::TokioIo;
use protobuf::MessageField;
use protobuf::well_known_types::timestamp::Timestamp;
use pyth_lazer_protocol::{
    publisher::{
        PriceFeedDataV1, PriceFeedDataV2, ServerResponse, UpdateDeserializationErrorResponse,
    },
    router::PublisherId,
};
use pyth_lazer_publisher_sdk::publisher_update::feed_update::Update;
use pyth_lazer_publisher_sdk::publisher_update::{FeedUpdate, FundingRateUpdate, PriceUpdate};
use soketto::{Incoming, handshake::http::Server};
use tokio::{
    pin, select,
    time::{Instant, sleep},
};
use tokio_util::compat::TokioAsyncReadCompatExt;
use tracing::{error, instrument, warn};

use crate::{
    http_server,
    lazer_publisher::LazerPublisher,
    websocket_utils::{handle_websocket_error, send_ping, send_text},
};

//pub const MAX_EXPIRY_TIME_US: u64 = 5_000_000; // 5s
//pub const MAX_TIMESTAMP_ERROR_US: u64 = 50_000; // 5ms
const PUBLISHER_TIMEOUT: Duration = Duration::from_secs(5);
const PING_FREQUENCY: Duration = Duration::from_secs(5);

pub struct PublisherConnectionContext {
    pub request_type: http_server::Request,
    pub publisher_id: PublisherId,
    pub _remote_addr: SocketAddr,
}

#[instrument(
    skip(server, request, lazer_publisher, context),
    fields(component = "publisher_ws", publisher_id = context.publisher_id.0)
)]
pub async fn handle_publisher(
    server: Server,
    request: hyper::Request<hyper::body::Incoming>,
    context: PublisherConnectionContext,
    lazer_publisher: LazerPublisher,
) {
    if let Err(err) = try_handle_publisher(server, request, context, lazer_publisher).await {
        handle_websocket_error(err);
    }
}

#[instrument(
    skip(server, request, lazer_publisher, context),
    fields(component = "publisher_ws", publisher_id = context.publisher_id.0)
)]
async fn try_handle_publisher(
    server: Server,
    request: hyper::Request<hyper::body::Incoming>,
    context: PublisherConnectionContext,
    lazer_publisher: LazerPublisher,
) -> anyhow::Result<()> {
    let stream = hyper::upgrade::on(request).await?;
    let io = TokioIo::new(stream);
    let stream = BufReader::new(BufWriter::new(io.compat()));
    let (mut ws_sender, mut ws_receiver) = server.into_builder(stream).finish();

    let mut receive_type: Option<Incoming>;
    let mut receive_buf = Vec::new();
    let publisher_timeout = sleep(PUBLISHER_TIMEOUT);
    pin!(publisher_timeout);
    //let mut last_ping_timestamp: Option<TimestampUs> = None;
    let mut ping_interval = tokio::time::interval(PING_FREQUENCY);

    let mut error_count = 0u32;
    const MAX_ERROR_LOG: u32 = 10u32;
    const MAX_ERROR_DISCONNECT: u32 = 100u32;

    loop {
        receive_buf.clear();
        {
            // soketto is not cancel-safe, so we need to store the future and poll it
            // in the inner loop.
            let receive = async { ws_receiver.receive(&mut receive_buf).await };
            pin!(receive);
            #[allow(clippy::never_loop)] // false positive
            loop {
                select! {
                    result = &mut receive => {
                        receive_type = Some(result?);
                        break
                    }
                    _ = ping_interval.tick() => {
                        send_ping(&mut ws_sender).await;
                        //last_ping_timestamp = Some(TimestampUs::now());
                    }
                    _ = &mut publisher_timeout => {
                        bail!("no updates received from publisher after {:?}", PUBLISHER_TIMEOUT);
                    }
                }
            }
        }
        publisher_timeout
            .as_mut()
            .reset(Instant::now() + PUBLISHER_TIMEOUT);

        if let Some(Incoming::Pong(_)) = receive_type {
            continue;
        }

        // reply with an error if we can't parse the binary update
        let feed_update: FeedUpdate = match context.request_type {
            http_server::Request::PublisherV1 => {
                match bincode::serde::decode_from_slice::<PriceFeedDataV1, _>(
                    &receive_buf,
                    bincode::config::legacy(),
                ) {
                    Ok((data, _)) => {
                        let source_timestamp = MessageField::some(Timestamp {
                            seconds: (data.source_timestamp_us.0 / 1_000_000) as i64,
                            nanos: (data.source_timestamp_us.0 % 1_000_000 * 1000) as i32,
                            special_fields: Default::default(),
                        });
                        FeedUpdate {
                            feed_id: Some(data.price_feed_id.0),
                            source_timestamp,
                            update: Some(Update::PriceUpdate(PriceUpdate {
                                price: data.price.map(|p| p.0.get()),
                                best_bid_price: data.best_bid_price.map(|p| p.0.get()),
                                best_ask_price: data.best_ask_price.map(|p| p.0.get()),
                                ..PriceUpdate::default()
                            })),
                            special_fields: Default::default(),
                        }
                    }
                    Err(err) => {
                        error_count += 1;
                        if error_count <= MAX_ERROR_LOG {
                            warn!(
                                "Error decoding v1 update from publisher_id {:?} error: {:?}",
                                context.publisher_id, err
                            );
                        }
                        if error_count >= MAX_ERROR_DISCONNECT {
                            error!(
                                "Error threshold reached for publisher_id {:?}; disconnecting",
                                context.publisher_id
                            );
                            bail!("Error threshold reached");
                        }
                        let error_json = &serde_json::to_string::<ServerResponse>(
                            &UpdateDeserializationErrorResponse {
                                error: format!("failed to parse binary update: {}", err),
                            }
                            .into(),
                        )?;
                        send_text(&mut ws_sender, error_json).await?;
                        continue;
                    }
                }
            }
            http_server::Request::PublisherV2 => {
                match bincode::serde::decode_from_slice::<PriceFeedDataV2, _>(
                    &receive_buf,
                    bincode::config::legacy(),
                ) {
                    Ok((data, _)) => {
                        let source_timestamp = MessageField::some(Timestamp {
                            seconds: (data.source_timestamp_us.0 / 1_000_000) as i64,
                            nanos: (data.source_timestamp_us.0 % 1_000_000 * 1000) as i32,
                            special_fields: Default::default(),
                        });
                        FeedUpdate {
                            feed_id: Some(data.price_feed_id.0),
                            source_timestamp,
                            update: Some(Update::FundingRateUpdate(FundingRateUpdate {
                                price: data.price.map(|p| p.0.get()),
                                rate: data.funding_rate.map(|r| r.0),
                                ..FundingRateUpdate::default()
                            })),
                            special_fields: Default::default(),
                        }
                    }
                    Err(err) => {
                        error_count += 1;
                        if error_count <= MAX_ERROR_LOG {
                            warn!(
                                "Error decoding v2 update from publisher_id {:?} error: {:?}",
                                context.publisher_id, err
                            );
                        }
                        if error_count >= MAX_ERROR_DISCONNECT {
                            error!(
                                "Error threshold reached for publisher_id {:?}; disconnecting",
                                context.publisher_id
                            );
                            bail!("Error threshold reached");
                        }
                        let error_json = &serde_json::to_string::<ServerResponse>(
                            &UpdateDeserializationErrorResponse {
                                error: format!("failed to parse binary update: {}", err),
                            }
                            .into(),
                        )?;
                        send_text(&mut ws_sender, error_json).await?;
                        continue;
                    }
                }
            } //_ => bail!("Publisher API request set with invalid context"),
        };

        // TODO: The relayer does timestamp validation here and marks an update as rejected
        //       if it is stale or in the future.

        lazer_publisher.push_feed_update(feed_update).await?;
    }
}
