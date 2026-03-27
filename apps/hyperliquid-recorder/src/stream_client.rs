use std::{str::FromStr, time::Duration};

use anyhow::Result;
use rust_decimal::Decimal;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;
use tonic::{
    metadata::MetadataValue,
    transport::{Channel, ClientTlsConfig, Endpoint},
    Request, Status,
};

use crate::{
    metrics::RecorderMetrics,
    models::{L2Level, L2Snapshot, MarketSubscription},
    proto::hyperliquid::{order_book_streaming_client::OrderBookStreamingClient, L2BookRequest},
};

pub async fn run_stream_worker(
    endpoint: String,
    auth_token: String,
    market: MarketSubscription,
    max_backoff_seconds: u64,
    sender: mpsc::Sender<L2Snapshot>,
    metrics: std::sync::Arc<RecorderMetrics>,
    stop_token: CancellationToken,
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
                    "stream error"
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
                tracing::error!(coin = market.coin, error = ?err, "unexpected stream failure");
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

async fn stream_once(
    endpoint: &str,
    auth_token: &str,
    market: &MarketSubscription,
    sender: mpsc::Sender<L2Snapshot>,
    stop_token: CancellationToken,
    metrics: std::sync::Arc<RecorderMetrics>,
) -> std::result::Result<(), StreamError> {
    let channel = build_channel(endpoint)
        .await
        .map_err(StreamError::Other)?;
    let mut client = OrderBookStreamingClient::new(channel).max_decoding_message_size(100 * 1024 * 1024);

    let request = L2BookRequest {
        coin: market.coin.clone(),
        n_levels: market.n_levels,
        n_sig_figs: market.n_sig_figs,
        mantissa: market.mantissa,
    };
    let mut request = Request::new(request);
    let token = MetadataValue::try_from(auth_token).map_err(|e| StreamError::Other(e.into()))?;
    request.metadata_mut().insert("x-token", token);

    let response = client
        .stream_l2_book(request)
        .await
        .map_err(StreamError::Grpc)?;

    let mut stream = response.into_inner();
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

        let coin = snapshot.coin.clone();
        if tokio::time::timeout(Duration::from_secs(1), sender.send(snapshot))
            .await
            .is_err()
        {
            metrics.queue_drops.with_label_values(&[&coin]).inc();
        }
    }

    Ok(())
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
