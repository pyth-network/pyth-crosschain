use std::{
    collections::HashMap,
    str::FromStr,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use anyhow::Result;
use pyth_lazer_protocol::{Price, publisher::PriceFeedDataV2, time::TimestampUs};
use rust_decimal::Decimal;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tokio_util::sync::CancellationToken;
use tonic::{
    Request, Status,
    metadata::MetadataValue,
    transport::{Channel, ClientTlsConfig, Endpoint},
};
use tracing::error;

use crate::{
    config::FeedConfig,
    metrics::RecorderMetrics,
    models::{L2Level, L2Snapshot, MarketSubscription, TradeRecord, parse_trades_payload},
    proto::hyperliquid::{
        FilterValues, L2BookRequest, Ping, StreamSubscribe, StreamType, SubscribeRequest,
        order_book_streaming_client::OrderBookStreamingClient, streaming_client::StreamingClient,
        subscribe_request, subscribe_update,
    },
};

pub async fn run_stream_worker(
    endpoint: String,
    auth_token: String,
    market: MarketSubscription,
    max_backoff_seconds: u64,
    sender: mpsc::Sender<L2Snapshot>,
    metrics: std::sync::Arc<RecorderMetrics>,
    stop_token: CancellationToken,
    publisher: mpsc::Sender<PriceFeedDataV2>,
) {
    let mut delay_seconds = 1_u64;
    while !stop_token.is_cancelled() {
        match stream_once(
            &endpoint,
            &auth_token,
            &market,
            sender.clone(),
            stop_token.clone(),
            metrics.clone(),
            &publisher,
        )
        .await
        {
            Ok(()) => {
                delay_seconds = 1;
            }
            Err(StreamError::Grpc(status)) => {
                let code = status.code().to_string();
                metrics
                    .stream_errors
                    .with_label_values(&[&market.coin, &code])
                    .inc();
                metrics
                    .stream_reconnects
                    .with_label_values(&[&market.coin, &code])
                    .inc();
                tracing::warn!(
                    coin = market.coin,
                    code = code,
                    details = status.message(),
                    "L2 stream error"
                );
                tokio::time::sleep(Duration::from_secs(delay_seconds)).await;
                delay_seconds = (delay_seconds.saturating_mul(2)).min(max_backoff_seconds.max(1));
            }
            Err(StreamError::Other(err)) => {
                metrics
                    .stream_errors
                    .with_label_values(&[&market.coin, "EXCEPTION"])
                    .inc();
                metrics
                    .stream_reconnects
                    .with_label_values(&[&market.coin, "EXCEPTION"])
                    .inc();
                tracing::error!(coin = market.coin, error = ?err, "unexpected L2 stream failure");
                tokio::time::sleep(Duration::from_secs(delay_seconds)).await;
                delay_seconds = (delay_seconds.saturating_mul(2)).min(max_backoff_seconds.max(1));
            }
        }
    }
}

pub async fn run_trades_stream_worker(
    endpoint: String,
    auth_token: String,
    markets: Vec<MarketSubscription>,
    max_backoff_seconds: u64,
    sender: mpsc::Sender<TradeRecord>,
    publisher: mpsc::Sender<PriceFeedDataV2>,
    metrics: std::sync::Arc<RecorderMetrics>,
    stop_token: CancellationToken,
) {
    let mut delay_seconds = 1_u64;
    let coin_markets = HashMap::<String, MarketSubscription>::from_iter(
        markets.into_iter().map(|m| (m.coin.clone(), m)),
    );
    while !stop_token.is_cancelled() {
        match stream_trades_once(
            &endpoint,
            &auth_token,
            &coin_markets,
            sender.clone(),
            &publisher,
            stop_token.clone(),
            metrics.clone(),
        )
        .await
        {
            Ok(()) => {
                delay_seconds = 1;
            }
            Err(StreamError::Grpc(status)) => {
                let code = status.code().to_string();
                metrics
                    .trades_stream_errors
                    .with_label_values(&[&code])
                    .inc();
                metrics
                    .trades_stream_reconnects
                    .with_label_values(&[&code])
                    .inc();
                tracing::warn!(
                    code = code,
                    details = status.message(),
                    "trades stream error"
                );
                tokio::time::sleep(Duration::from_secs(delay_seconds)).await;
                delay_seconds = (delay_seconds.saturating_mul(2)).min(max_backoff_seconds.max(1));
            }
            Err(StreamError::Other(err)) => {
                metrics
                    .trades_stream_errors
                    .with_label_values(&["EXCEPTION"])
                    .inc();
                metrics
                    .trades_stream_reconnects
                    .with_label_values(&["EXCEPTION"])
                    .inc();
                tracing::error!(error = ?err, "unexpected trades stream failure");
                tokio::time::sleep(Duration::from_secs(delay_seconds)).await;
                delay_seconds = (delay_seconds.saturating_mul(2)).min(max_backoff_seconds.max(1));
            }
        }
    }
}

enum StreamError {
    Grpc(Status),
    Other(anyhow::Error),
}

impl From<anyhow::Error> for StreamError {
    fn from(value: anyhow::Error) -> Self {
        Self::Other(value)
    }
}

async fn stream_once(
    endpoint: &str,
    auth_token: &str,
    market: &MarketSubscription,
    sender: mpsc::Sender<L2Snapshot>,
    stop_token: CancellationToken,
    metrics: std::sync::Arc<RecorderMetrics>,
    publisher: &mpsc::Sender<PriceFeedDataV2>,
) -> std::result::Result<(), StreamError> {
    let channel = build_channel(endpoint).await?;
    let mut client =
        OrderBookStreamingClient::new(channel).max_decoding_message_size(100 * 1024 * 1024);

    let request = L2BookRequest {
        coin: market.coin.clone(),
        n_levels: market.n_levels,
        n_sig_figs: market.n_sig_figs,
        mantissa: market.mantissa,
    };
    let mut request = Request::new(request);
    let token = MetadataValue::try_from(auth_token).map_err(anyhow::Error::from)?;
    request.metadata_mut().insert("x-token", token);

    let response = client
        .stream_l2_book(request)
        .await
        .map_err(StreamError::Grpc)?;

    let mut stream = response.into_inner();
    let mut total_rows_streamed: u64 = 0;
    let mut interval_rows_streamed: u64 = 0;
    let mut last_stream_report = Instant::now();
    while let Some(update) = stream.message().await.map_err(StreamError::Grpc)? {
        if stop_token.is_cancelled() {
            break;
        }
        let snapshot = L2Snapshot {
            coin: update.coin,
            block_time_ms: update.time,
            block_number: update.block_number,
            n_levels: market.n_levels,
            n_sig_figs: market.n_sig_figs,
            mantissa: market.mantissa,
            source_endpoint: endpoint.to_string(),
            bids: update
                .bids
                .iter()
                .filter_map(|level| to_level(level).ok())
                .collect(),
            asks: update
                .asks
                .iter()
                .filter_map(|level| to_level(level).ok())
                .collect(),
        };

        metrics.record_snapshot(&snapshot);

        if let Some(feed) = &market.feed
            && !publisher.is_closed()
        {
            match l2_snapshot_to_feed_update(feed, &snapshot) {
                Ok(update) => {
                    if let Err(err) = publisher.try_send(update) {
                        error!(%market.coin, ?err, "publisher channel error");
                    }
                }
                Err(err) => error!(%err, "feed update creation error"),
            }
        }

        let coin = snapshot.coin.clone();
        if tokio::time::timeout(Duration::from_secs(1), sender.send(snapshot))
            .await
            .is_err()
        {
            metrics.queue_drops.with_label_values(&[&coin]).inc();
        }

        total_rows_streamed = total_rows_streamed.saturating_add(1);
        interval_rows_streamed = interval_rows_streamed.saturating_add(1);
        let elapsed = last_stream_report.elapsed();
        if elapsed >= Duration::from_secs(5) {
            tracing::info!(
                coin = %market.coin,
                interval_rows = interval_rows_streamed,
                total_rows = total_rows_streamed,
                rows_per_second = interval_rows_streamed as f64 / elapsed.as_secs_f64().max(1e-9),
                "L2 stream row throughput"
            );
            interval_rows_streamed = 0;
            last_stream_report = Instant::now();
        }
    }

    if interval_rows_streamed > 0 {
        let elapsed = last_stream_report.elapsed();
        tracing::info!(
            coin = %market.coin,
            interval_rows = interval_rows_streamed,
            total_rows = total_rows_streamed,
            rows_per_second = interval_rows_streamed as f64 / elapsed.as_secs_f64().max(1e-9),
            "L2 stream row throughput (final interval)"
        );
    }

    Ok(())
}

fn l2_snapshot_to_feed_update(feed: &FeedConfig, snapshot: &L2Snapshot) -> Result<PriceFeedDataV2> {
    Ok(PriceFeedDataV2 {
        price_feed_id: feed.id,
        source_timestamp_us: TimestampUs::from_millis(snapshot.block_time_ms)?,
        publisher_timestamp_us: TimestampUs::now(),
        price: None,
        // TODO: would be better served by some new `Price::from_decimal` function
        best_bid_price: snapshot
            .bids
            .first()
            .map(|b| Price::parse_str(&b.px.to_string(), feed.exponent.into()))
            .transpose()?,
        best_ask_price: snapshot
            .asks
            .first()
            .map(|b| Price::parse_str(&b.px.to_string(), feed.exponent.into()))
            .transpose()?,
        funding_rate: None,
    })
}

async fn stream_trades_once(
    endpoint: &str,
    auth_token: &str,
    coin_markets: &HashMap<String, MarketSubscription>,
    sender: mpsc::Sender<TradeRecord>,
    publisher: &mpsc::Sender<PriceFeedDataV2>,
    stop_token: CancellationToken,
    metrics: std::sync::Arc<RecorderMetrics>,
) -> std::result::Result<(), StreamError> {
    let channel = build_channel(endpoint).await?;
    let mut client = StreamingClient::new(channel).max_decoding_message_size(100 * 1024 * 1024);

    let (request_sender, request_receiver) = mpsc::channel::<SubscribeRequest>(16);
    let mut filters = HashMap::new();
    filters.insert(
        "coin".to_owned(),
        FilterValues {
            values: coin_markets.keys().cloned().collect(),
        },
    );
    request_sender
        .send(SubscribeRequest {
            request: Some(subscribe_request::Request::Subscribe(StreamSubscribe {
                stream_type: StreamType::Trades as i32,
                filters,
                filter_name: "markets".to_string(),
            })),
        })
        .await
        .map_err(|err| StreamError::Other(err.into()))?;

    let ping_sender = request_sender.clone();
    let ping_stop_token = stop_token.clone();
    let ping_handle = tokio::spawn(async move {
        while !ping_stop_token.is_cancelled() {
            tokio::time::sleep(Duration::from_secs(30)).await;
            if ping_stop_token.is_cancelled() {
                break;
            }
            let request = SubscribeRequest {
                request: Some(subscribe_request::Request::Ping(Ping {
                    timestamp: unix_millis_now(),
                })),
            };
            if ping_sender.send(request).await.is_err() {
                break;
            }
        }
    });

    let mut request = Request::new(ReceiverStream::new(request_receiver));
    let token = MetadataValue::try_from(auth_token).map_err(|e| StreamError::Other(e.into()))?;
    request.metadata_mut().insert("x-token", token);

    let response = client
        .stream_data(request)
        .await
        .map_err(StreamError::Grpc)?;
    let mut stream = response.into_inner();
    let mut total_rows_streamed: u64 = 0;
    let mut interval_rows_streamed: u64 = 0;
    let mut last_stream_report = Instant::now();
    while let Some(update) = stream.message().await.map_err(StreamError::Grpc)? {
        if stop_token.is_cancelled() {
            break;
        }

        match update.update {
            Some(subscribe_update::Update::Data(data)) => {
                match parse_trades_payload(&data.data, data.block_number, endpoint) {
                    Ok(trades) => {
                        let trade_count = trades.len() as u64;

                        // TODO: some averaging?
                        if let Some(trade) = trades.last() {
                            if let Some(market) = coin_markets.get(&trade.coin) {
                                if let Some(feed) = &market.feed
                                    && !publisher.is_closed()
                                {
                                    match trade_record_to_feed_update(feed, trade) {
                                        Ok(update) => {
                                            if let Err(err) = publisher.send(update).await {
                                                error!(%market.coin, ?err, "publisher channel error");
                                            }
                                        }
                                        Err(err) => error!(%err, "feed update creation error"),
                                    }
                                }
                            } else {
                                error!("could not find coin '{}' in markets", trade.coin);
                            }
                        }

                        for trade in trades {
                            metrics.record_trade(&trade);
                            let coin = trade.coin.clone();
                            if tokio::time::timeout(Duration::from_secs(1), sender.send(trade))
                                .await
                                .is_err()
                            {
                                metrics.trades_queue_drops.with_label_values(&[&coin]).inc();
                            }
                        }
                        total_rows_streamed = total_rows_streamed.saturating_add(trade_count);
                        interval_rows_streamed = interval_rows_streamed.saturating_add(trade_count);
                        let elapsed = last_stream_report.elapsed();
                        if elapsed >= Duration::from_secs(5) {
                            tracing::info!(
                                interval_rows = interval_rows_streamed,
                                total_rows = total_rows_streamed,
                                rows_per_second =
                                    interval_rows_streamed as f64 / elapsed.as_secs_f64().max(1e-9),
                                "TRADES stream row throughput"
                            );
                            interval_rows_streamed = 0;
                            last_stream_report = Instant::now();
                        }
                    }
                    Err(error) => {
                        metrics.trades_payload_errors.inc();
                        tracing::warn!(error = ?error, "failed to decode trades payload");
                    }
                }
            }
            Some(subscribe_update::Update::Pong(_)) => {}
            None => {}
        }
    }

    if interval_rows_streamed > 0 {
        let elapsed = last_stream_report.elapsed();
        tracing::info!(
            interval_rows = interval_rows_streamed,
            total_rows = total_rows_streamed,
            rows_per_second = interval_rows_streamed as f64 / elapsed.as_secs_f64().max(1e-9),
            "TRADES stream row throughput (final interval)"
        );
    }

    ping_handle.abort();
    Ok(())
}

fn trade_record_to_feed_update(feed: &FeedConfig, trade: &TradeRecord) -> Result<PriceFeedDataV2> {
    Ok(PriceFeedDataV2 {
        price_feed_id: feed.id,
        source_timestamp_us: TimestampUs::from_millis(trade.time_ms)?,
        publisher_timestamp_us: TimestampUs::now(),
        // TODO: would be better served by some new `Price::from_decimal` function
        price: Some(Price::parse_str(
            &trade.px.to_string(),
            feed.exponent.into(),
        )?),
        best_bid_price: None,
        best_ask_price: None,
        funding_rate: None,
    })
}

fn to_level(level: &crate::proto::hyperliquid::L2Level) -> Result<L2Level> {
    let px = Decimal::from_str(&level.px)?;
    let sz = Decimal::from_str(&level.sz)?;
    Ok(L2Level { px, sz, n: level.n })
}

async fn build_channel(endpoint: &str) -> Result<Channel> {
    let address = if endpoint.starts_with("http://") || endpoint.starts_with("https://") {
        endpoint.to_string()
    } else {
        format!("https://{endpoint}")
    };
    let endpoint = Endpoint::from_shared(address)?
        .tls_config(ClientTlsConfig::new())?
        .http2_keep_alive_interval(Duration::from_secs(30))
        .keep_alive_while_idle(true)
        .connect_timeout(Duration::from_secs(10));
    Ok(endpoint.connect().await?)
}

fn unix_millis_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_millis() as i64
}
