use std::{sync::Arc, time::Duration};

use anyhow::{bail, Context, Result};
use chrono::Utc;
use futures::{SinkExt, StreamExt};
use serde_json::json;
use tokio::sync::mpsc;
use tokio::sync::mpsc::error::TrySendError;
use tokio::time::Instant;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tokio_util::sync::CancellationToken;

use crate::health::HealthState;
use crate::metrics::RecorderMetrics;
use crate::models::{parse_frame, LaneRow, ParsedFrame, BBO_TBT_CHANNEL};

/// A connection that survives this long before failing is considered to have
/// been healthy, so the reconnect backoff resets instead of compounding.
const BACKOFF_RESET_AFTER: Duration = Duration::from_secs(60);

/// Run the websocket worker: one connection to the OKX public endpoint
/// multiplexing a `bbo-tbt` subscription per configured instrument, reconnected
/// with jittered exponential backoff for the life of the process.
///
/// Each data frame is stamped with a client-side `received_at`, parsed into
/// [`LaneRow`]s, and `try_send`-ed into the writer channel. A full channel
/// increments the per-instrument `queue_drops` metric and drops the row
/// (bounded buffer, observable drops) rather than blocking the read loop.
///
/// OKX closes a connection that has been idle for 30 seconds; the trades lane
/// will bring an application-level ping keepalive with it. Until then an idle
/// connection (all instruments halted) surfaces as a server close, and this
/// loop re-subscribes after backoff. Additional channel subscriptions (trades)
/// extend [`subscribe_payload`] and the `ParsedFrame::Data` dispatch below.
pub async fn run_stream_worker(
    ws_url: String,
    inst_ids: Vec<String>,
    max_backoff_seconds: u64,
    sender: mpsc::Sender<LaneRow>,
    metrics: Arc<RecorderMetrics>,
    health: HealthState,
    stop_token: CancellationToken,
) {
    let mut delay_seconds = 1_u64;
    while !stop_token.is_cancelled() {
        let connected_at = Instant::now();
        match stream_once(&ws_url, &inst_ids, &sender, &metrics, &health, &stop_token).await {
            // A clean return means stop was requested.
            Ok(()) => return,
            Err(err) => {
                if stop_token.is_cancelled() {
                    return;
                }
                metrics.stream_reconnects.inc();
                tracing::warn!(error = ?err, "websocket stream failed; reconnecting");
                if connected_at.elapsed() >= BACKOFF_RESET_AFTER {
                    delay_seconds = 1;
                }
                jittered_backoff(delay_seconds, &stop_token).await;
                delay_seconds = delay_seconds
                    .saturating_mul(2)
                    .min(max_backoff_seconds.max(1));
            }
        }
    }
}

/// One connect → subscribe → read-until-failure cycle. Returns `Ok(())` only
/// when stop was requested; any connection failure is an error so the caller
/// reconnects.
async fn stream_once(
    ws_url: &str,
    inst_ids: &[String],
    sender: &mpsc::Sender<LaneRow>,
    metrics: &RecorderMetrics,
    health: &HealthState,
    stop_token: &CancellationToken,
) -> Result<()> {
    let (mut ws, _response) = connect_async(ws_url)
        .await
        .with_context(|| format!("connect to OKX websocket at {ws_url}"))?;
    tracing::info!(url = %ws_url, "connected to OKX public websocket");

    let payload =
        serde_json::to_string(&subscribe_payload(inst_ids)).context("serialize subscribe frame")?;
    ws.send(Message::Text(payload))
        .await
        .context("send subscribe frame")?;

    loop {
        tokio::select! {
            () = stop_token.cancelled() => {
                tracing::info!("stop requested; closing websocket");
                if let Err(err) = ws.close(None).await {
                    tracing::debug!(error = ?err, "error closing websocket");
                }
                return Ok(());
            }
            message = ws.next() => {
                match message {
                    Some(Ok(Message::Text(text))) => {
                        handle_text_frame(&text, sender, metrics, health);
                    }
                    // tungstenite answers protocol pings internally; OKX's
                    // application-level ping/pong is text-frame based and owned
                    // by the trades-lane follow-up.
                    Some(Ok(Message::Ping(_) | Message::Pong(_))) => {}
                    Some(Ok(Message::Binary(_) | Message::Frame(_))) => {}
                    Some(Ok(Message::Close(frame))) => {
                        bail!("server closed connection: {frame:?}");
                    }
                    Some(Err(err)) => {
                        return Err(err).context("websocket read failed");
                    }
                    None => bail!("websocket stream ended"),
                }
            }
        }
    }
}

/// The single subscribe frame sent after connect: one `bbo-tbt` arg per
/// instrument, multiplexed on this connection. Follow-up lanes append their
/// channel args here.
fn subscribe_payload(inst_ids: &[String]) -> serde_json::Value {
    let args: Vec<serde_json::Value> = inst_ids
        .iter()
        .map(|inst_id| json!({ "channel": BBO_TBT_CHANNEL, "instId": inst_id }))
        .collect();
    json!({ "op": "subscribe", "args": args })
}

fn handle_text_frame(
    text: &str,
    sender: &mpsc::Sender<LaneRow>,
    metrics: &RecorderMetrics,
    health: &HealthState,
) {
    let received_at = Utc::now();
    match parse_frame(text, received_at) {
        Ok(ParsedFrame::Data { inst_id, rows }) => {
            // Freshness keys on receipt, not insert success: a frame arriving
            // for `inst_id` proves the ToB lane is live even if the bounded
            // queue later drops the rows.
            health.set_instrument_seen(&inst_id);
            metrics.record_tob_seen(&inst_id);
            for row in rows {
                match sender.try_send(row) {
                    Ok(()) => {}
                    Err(TrySendError::Full(_)) => {
                        metrics.record_queue_drop(&inst_id);
                        tracing::debug!(inst_id = %inst_id, "dropping row (queue full)");
                    }
                    Err(TrySendError::Closed(_)) => {
                        tracing::debug!(inst_id = %inst_id, "dropping row (channel closed)");
                    }
                }
            }
        }
        Ok(ParsedFrame::Event {
            event,
            code,
            message,
        }) => {
            // A rejected subscribe (e.g. an instrument that doesn't exist)
            // surfaces as perpetual staleness in /ready, so an error event is
            // logged but doesn't tear down the connection.
            if event == "error" {
                tracing::warn!(?code, ?message, "OKX websocket error event");
            } else {
                tracing::info!(event = %event, "OKX websocket event");
            }
        }
        Ok(ParsedFrame::UnhandledChannel { channel }) => {
            tracing::debug!(channel = %channel, "ignoring frame for unhandled channel");
        }
        Err(err) => {
            tracing::warn!(error = ?err, "dropping unparseable websocket frame");
        }
    }
}

/// Full-jitter backoff: sleep a uniform random duration in [0, delay_seconds],
/// cut short if stop is requested. Prevents thundering-herd reconnects when
/// multiple recorder instances back off in lockstep.
async fn jittered_backoff(delay_seconds: u64, stop_token: &CancellationToken) {
    if delay_seconds == 0 {
        return;
    }
    let jittered_ms = fastrand::u64(0..=delay_seconds.saturating_mul(1000));
    tokio::select! {
        () = stop_token.cancelled() => {}
        () = tokio::time::sleep(Duration::from_millis(jittered_ms)) => {}
    }
}
