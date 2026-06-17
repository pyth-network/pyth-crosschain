use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use binance_sdk::config::ConfigurationWebsocketStreams;
use binance_sdk::spot::websocket_streams::BookTickerParams;
use binance_sdk::spot::SpotWsStreams;
use chrono::Utc;
use tokio::sync::mpsc;
use tokio::sync::mpsc::error::TrySendError;
use tokio_util::sync::CancellationToken;

use crate::health::HealthState;
use crate::metrics::RecorderMetrics;
use crate::models::BookTicker;

/// Bridge the SDK's callback-based `bookTicker` streams into the recorder's
/// mpsc pipeline.
///
/// One combined connection multiplexes every symbol (well under Binance's
/// 1024-streams-per-connection cap). The SDK owns reconnection and ping/pong
/// keepalive internally — `reconnect_delay_ms` configures the reconnect pause;
/// there is no on/off toggle, reconnection is always enabled. The per-symbol
/// `on_message` callback is a synchronous `Fn`, so it cannot `.await`; it stamps
/// `received_at`, converts to [`BookTicker`], and `try_send`s into the channel.
/// A full channel increments the per-symbol `queue_drops` metric and drops the
/// row (bounded buffer, observable drops) rather than blocking the callback.
pub async fn run_stream_worker(
    symbols: Vec<String>,
    reconnect_delay_ms: u64,
    sender: mpsc::Sender<BookTicker>,
    metrics: Arc<RecorderMetrics>,
    health: HealthState,
    stop_token: CancellationToken,
) -> Result<()> {
    let config = ConfigurationWebsocketStreams::builder()
        .reconnect_delay(reconnect_delay_ms)
        .build()
        .map_err(|err| anyhow!("failed to build websocket streams config: {err}"))?;

    let connection = SpotWsStreams::production(config)
        .connect()
        .await
        .context("connect to Binance spot websocket streams")?;

    // Keep the subscription handles alive for the lifetime of the connection.
    let mut streams = Vec::with_capacity(symbols.len());
    for symbol in &symbols {
        let params = BookTickerParams::builder(symbol.to_lowercase())
            .build()
            .map_err(|err| anyhow!("failed to build book_ticker params for {symbol}: {err}"))?;

        let stream = connection
            .book_ticker(params)
            .await
            .with_context(|| format!("subscribe {symbol}@bookTicker"))?;

        let tx = sender.clone();
        let sym = symbol.clone();
        let metrics = metrics.clone();
        let health = health.clone();
        stream.on_message(move |resp| {
            let received_at = Utc::now();
            match BookTicker::from_sdk(resp, received_at) {
                Ok(ticker) => {
                    // Freshness keys on receipt, not insert success: an update
                    // arriving for `sym` proves the stream is live even if the
                    // bounded queue later drops it.
                    health.set_symbol_seen(&sym);
                    metrics.record_symbol_seen(&sym);
                    match tx.try_send(ticker) {
                        Ok(()) => {}
                        Err(TrySendError::Full(_)) => {
                            metrics.record_queue_drop(&sym);
                            tracing::debug!(symbol = %sym, "dropping book ticker (queue full)");
                        }
                        Err(TrySendError::Closed(_)) => {
                            tracing::debug!(symbol = %sym, "dropping book ticker (channel closed)");
                        }
                    }
                }
                Err(err) => {
                    tracing::warn!(
                        symbol = %sym,
                        error = ?err,
                        "dropping unparseable book ticker update"
                    );
                }
            }
        });
        tracing::info!(symbol = %symbol, "subscribed to bookTicker stream");
        streams.push(stream);
    }

    stop_token.cancelled().await;
    tracing::info!("stop requested; disconnecting websocket streams");
    if let Err(err) = connection.disconnect().await {
        tracing::warn!(error = ?err, "error during websocket disconnect");
    }
    drop(streams);
    Ok(())
}
