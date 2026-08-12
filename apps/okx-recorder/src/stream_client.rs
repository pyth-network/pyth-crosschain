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
use crate::models::{parse_frame, Channel, LaneRow, ParsedFrame, BBO_TBT_CHANNEL, TRADES_CHANNEL};

/// A connection that survives this long before failing is considered to have
/// been healthy, so the reconnect backoff resets instead of compounding.
const BACKOFF_RESET_AFTER: Duration = Duration::from_secs(60);

/// OKX's application-level keepalive is text-frame based: the client sends the
/// literal string `ping` and the server answers with the literal string `pong`.
const PING_FRAME: &str = "ping";
const PONG_FRAME: &str = "pong";

/// Timing knobs for the client-initiated keepalive. OKX terminates a
/// connection with no traffic for 30 seconds, and thin pre-IPO perps have
/// genuinely quiet stretches, so the client must ping well inside that window.
#[derive(Clone, Copy, Debug)]
pub struct KeepaliveConfig {
    /// Send a [`PING_FRAME`] after this long without any inbound frame.
    pub ping_idle: Duration,
    /// Presume the connection dead when no frame (a [`PONG_FRAME`] or any
    /// data) arrives within this long of a keepalive ping.
    pub pong_timeout: Duration,
}

/// What the stream loop must do when the keepalive deadline fires.
#[derive(Debug, PartialEq, Eq)]
enum KeepaliveAction {
    /// The connection has been idle past the ping threshold: send a ping.
    SendPing,
    /// No frame arrived within the timeout after a ping: the connection is
    /// dead, tear it down and reconnect.
    ConnectionDead,
    /// Woken before the deadline actually elapsed: nothing to do.
    Wait,
}

/// Pure ping-scheduling / pong-timeout decision logic, kept free of any socket
/// so it is unit-testable. The stream loop feeds it inbound-frame timestamps
/// and deadline wakeups; it answers with the next deadline and the action to
/// take when that deadline fires.
struct KeepaliveState {
    config: KeepaliveConfig,
    /// When the last inbound frame arrived.
    last_inbound: Instant,
    /// When the outstanding keepalive ping was sent; `None` when no pong is
    /// awaited.
    ping_sent_at: Option<Instant>,
}

impl KeepaliveState {
    fn new(config: KeepaliveConfig, now: Instant) -> Self {
        Self {
            config,
            last_inbound: now,
            ping_sent_at: None,
        }
    }

    /// Record an inbound frame. Any frame — a pong, data, or an event — proves
    /// the connection alive, so this clears the outstanding ping and restarts
    /// the idle clock.
    fn on_inbound(&mut self, now: Instant) {
        self.last_inbound = now;
        self.ping_sent_at = None;
    }

    /// The next instant the stream loop must wake to act on keepalive: the
    /// pong deadline while a ping is outstanding, the idle-ping threshold
    /// otherwise.
    fn deadline(&self) -> Instant {
        match self.ping_sent_at {
            Some(sent_at) => sent_at + self.config.pong_timeout,
            None => self.last_inbound + self.config.ping_idle,
        }
    }

    /// Decide what to do at `now`, assuming the caller woke because
    /// [`Self::deadline`] fired. A wake before the deadline is a
    /// [`KeepaliveAction::Wait`] so a spurious wakeup never double-pings.
    fn on_deadline(&mut self, now: Instant) -> KeepaliveAction {
        match self.ping_sent_at {
            Some(sent_at) => {
                if now >= sent_at + self.config.pong_timeout {
                    KeepaliveAction::ConnectionDead
                } else {
                    KeepaliveAction::Wait
                }
            }
            None => {
                if now >= self.last_inbound + self.config.ping_idle {
                    self.ping_sent_at = Some(now);
                    KeepaliveAction::SendPing
                } else {
                    KeepaliveAction::Wait
                }
            }
        }
    }
}

/// Run the websocket worker: one connection to the OKX public endpoint
/// multiplexing a `bbo-tbt` and a `trades` subscription per configured
/// instrument, reconnected with jittered exponential backoff for the life of
/// the process.
///
/// Each data frame is stamped with a client-side `received_at`, parsed into
/// [`LaneRow`]s, and `try_send`-ed into the writer channel. A full channel
/// increments the per-instrument `queue_drops` metric and drops the row
/// (bounded buffer, observable drops) rather than blocking the read loop.
///
/// OKX closes a connection that has been idle for 30 seconds, so a
/// client-initiated keepalive (see [`KeepaliveConfig`]) pings during quiet
/// stretches; a missed pong tears the connection down and this loop
/// re-subscribes every instrument after backoff. Additional channel
/// subscriptions extend [`subscribe_payload`] and the `ParsedFrame::Data`
/// dispatch below.
#[allow(clippy::too_many_arguments)]
pub async fn run_stream_worker(
    ws_url: String,
    inst_ids: Vec<String>,
    max_backoff_seconds: u64,
    keepalive: KeepaliveConfig,
    sender: mpsc::Sender<LaneRow>,
    metrics: Arc<RecorderMetrics>,
    health: HealthState,
    stop_token: CancellationToken,
) {
    let mut delay_seconds = 1_u64;
    while !stop_token.is_cancelled() {
        let connected_at = Instant::now();
        match stream_once(
            &ws_url,
            &inst_ids,
            keepalive,
            &sender,
            &metrics,
            &health,
            &stop_token,
        )
        .await
        {
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
    keepalive_config: KeepaliveConfig,
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

    let mut keepalive = KeepaliveState::new(keepalive_config, Instant::now());
    loop {
        tokio::select! {
            () = stop_token.cancelled() => {
                tracing::info!("stop requested; closing websocket");
                if let Err(err) = ws.close(None).await {
                    tracing::debug!(error = ?err, "error closing websocket");
                }
                return Ok(());
            }
            () = tokio::time::sleep_until(keepalive.deadline()) => {
                match keepalive.on_deadline(Instant::now()) {
                    KeepaliveAction::SendPing => {
                        metrics.keepalive_pings.inc();
                        tracing::debug!("connection idle; sending keepalive ping");
                        ws.send(Message::Text(PING_FRAME.to_string()))
                            .await
                            .context("send keepalive ping")?;
                    }
                    KeepaliveAction::ConnectionDead => {
                        metrics.pong_timeouts.inc();
                        bail!(
                            "no pong within {}s of keepalive ping; presuming connection dead",
                            keepalive_config.pong_timeout.as_secs()
                        );
                    }
                    KeepaliveAction::Wait => {}
                }
            }
            message = ws.next() => {
                keepalive.on_inbound(Instant::now());
                match message {
                    // The literal `pong` answers our keepalive ping; its
                    // arrival was already recorded by `on_inbound` above.
                    Some(Ok(Message::Text(text))) if text == PONG_FRAME => {}
                    Some(Ok(Message::Text(text))) => {
                        handle_text_frame(&text, sender, metrics, health);
                    }
                    // tungstenite answers protocol pings internally; OKX's
                    // application-level keepalive is the text-frame
                    // `ping`/`pong` handled above.
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

/// The single subscribe frame sent after connect: one `bbo-tbt` and one
/// `trades` arg per instrument, multiplexed on this connection. Follow-up
/// lanes append their channel args here.
fn subscribe_payload(inst_ids: &[String]) -> serde_json::Value {
    let mut args = Vec::with_capacity(inst_ids.len().saturating_mul(2));
    for inst_id in inst_ids {
        args.push(json!({ "channel": BBO_TBT_CHANNEL, "instId": inst_id }));
        args.push(json!({ "channel": TRADES_CHANNEL, "instId": inst_id }));
    }
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
        Ok(ParsedFrame::Data {
            channel,
            inst_id,
            rows,
        }) => {
            // Freshness keys on receipt, not insert success: a frame arriving
            // for `inst_id` proves its lane is live even if the frame carries
            // no rows (OKX can push a data frame with an empty `data` array)
            // or the bounded queue later drops them, so stamping dispatches on
            // the frame's channel rather than its rows. Only the ToB lane
            // feeds /ready; trades freshness is a metric-only staleness signal
            // (a quiet trades lane on a thin perp is data, not an outage).
            match channel {
                Channel::BboTbt => {
                    health.set_instrument_seen(&inst_id);
                    metrics.record_tob_seen(&inst_id);
                }
                Channel::Trades => {
                    metrics.record_trade_seen(&inst_id);
                }
            }
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

#[cfg(test)]
mod tests {
    use super::*;

    const PING_IDLE: Duration = Duration::from_secs(15);
    const PONG_TIMEOUT: Duration = Duration::from_secs(5);

    fn state_at(now: Instant) -> KeepaliveState {
        KeepaliveState::new(
            KeepaliveConfig {
                ping_idle: PING_IDLE,
                pong_timeout: PONG_TIMEOUT,
            },
            now,
        )
    }

    #[test]
    fn test_quiet_connection_pings_at_idle_threshold() {
        let t0 = Instant::now();
        let mut state = state_at(t0);
        assert_eq!(state.deadline(), t0 + PING_IDLE);
        assert_eq!(state.on_deadline(t0 + PING_IDLE), KeepaliveAction::SendPing);
        // With the ping outstanding, the next deadline is the pong timeout.
        assert_eq!(state.deadline(), t0 + PING_IDLE + PONG_TIMEOUT);
    }

    #[test]
    fn test_inbound_traffic_defers_the_ping() {
        let t0 = Instant::now();
        let mut state = state_at(t0);
        state.on_inbound(t0 + Duration::from_secs(10));
        assert_eq!(state.deadline(), t0 + Duration::from_secs(10) + PING_IDLE);
        // A wake at the original deadline is before the deferred one: no ping.
        assert_eq!(state.on_deadline(t0 + PING_IDLE), KeepaliveAction::Wait);
        assert_eq!(state.deadline(), t0 + Duration::from_secs(10) + PING_IDLE);
    }

    #[test]
    fn test_missing_pong_declares_connection_dead() {
        let t0 = Instant::now();
        let mut state = state_at(t0);
        let ping_at = t0 + PING_IDLE;
        assert_eq!(state.on_deadline(ping_at), KeepaliveAction::SendPing);
        assert_eq!(
            state.on_deadline(ping_at + PONG_TIMEOUT),
            KeepaliveAction::ConnectionDead
        );
    }

    #[test]
    fn test_any_inbound_frame_clears_the_outstanding_ping() {
        let t0 = Instant::now();
        let mut state = state_at(t0);
        let ping_at = t0 + PING_IDLE;
        assert_eq!(state.on_deadline(ping_at), KeepaliveAction::SendPing);
        // A pong — or any data frame — arrives before the timeout: back on the
        // idle schedule, counted from the frame's arrival.
        let pong_at = ping_at + Duration::from_secs(2);
        state.on_inbound(pong_at);
        assert_eq!(state.deadline(), pong_at + PING_IDLE);
        assert_eq!(
            state.on_deadline(ping_at + PONG_TIMEOUT),
            KeepaliveAction::Wait
        );
    }

    #[test]
    fn test_early_wake_never_double_pings_or_kills() {
        let t0 = Instant::now();
        let mut state = state_at(t0);
        // Woken before the idle threshold: no ping.
        assert_eq!(
            state.on_deadline(t0 + PING_IDLE - Duration::from_secs(1)),
            KeepaliveAction::Wait
        );
        let ping_at = t0 + PING_IDLE;
        assert_eq!(state.on_deadline(ping_at), KeepaliveAction::SendPing);
        // Woken again before the pong timeout: neither a second ping nor a
        // premature death sentence.
        assert_eq!(
            state.on_deadline(ping_at + PONG_TIMEOUT - Duration::from_secs(1)),
            KeepaliveAction::Wait
        );
    }

    #[test]
    fn test_idle_ping_cycle_repeats_after_each_pong() {
        let t0 = Instant::now();
        let mut state = state_at(t0);
        let mut now = t0;
        for _ in 0..3 {
            now += PING_IDLE;
            assert_eq!(state.on_deadline(now), KeepaliveAction::SendPing);
            now += Duration::from_secs(1);
            state.on_inbound(now);
            assert_eq!(state.deadline(), now + PING_IDLE);
        }
    }
}
