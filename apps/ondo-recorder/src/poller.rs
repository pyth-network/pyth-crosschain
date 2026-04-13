use std::{sync::Arc, time::Duration};

use chrono::Utc;
use tokio::{
    sync::mpsc,
    time::{Instant, MissedTickBehavior},
};
use tokio_util::sync::CancellationToken;

use crate::{
    config::TokenConfig,
    health::HealthState,
    metrics::RecorderMetrics,
    models::{OndoApiRequest, OndoApiResponse, OndoQuote},
};

#[allow(clippy::too_many_arguments)]
pub async fn run_poller_for_token(
    http_client: reqwest::Client,
    api_url: String,
    api_key: String,
    chain_id: String,
    duration: String,
    token: TokenConfig,
    poll_interval: Duration,
    sender: mpsc::Sender<OndoQuote>,
    metrics: Arc<RecorderMetrics>,
    health: HealthState,
    stop_token: CancellationToken,
) {
    let sides = ["buy", "sell"];
    let mut interval = tokio::time::interval(poll_interval);
    interval.set_missed_tick_behavior(MissedTickBehavior::Delay);

    let mut total_rows: u64 = 0;
    let mut interval_rows: u64 = 0;
    let mut last_log = Instant::now();

    tracing::info!(symbol = %token.symbol, "starting poller");

    while !stop_token.is_cancelled() {
        interval.tick().await;
        if stop_token.is_cancelled() {
            break;
        }

        let polled_at = Utc::now();
        let poll_start = Instant::now();

        let mut futures = Vec::with_capacity(token.sizes.len() * sides.len());
        for &size in &token.sizes {
            for side in &sides {
                let request = OndoApiRequest {
                    chain_id: chain_id.clone(),
                    symbol: token.symbol.clone(),
                    side: side.to_string(),
                    token_amount: size.to_string(),
                    duration: duration.clone(),
                };
                futures.push(poll_once(
                    http_client.clone(),
                    api_url.clone(),
                    api_key.clone(),
                    request,
                ));
            }
        }

        let results = futures::future::join_all(futures).await;
        let poll_elapsed = poll_start.elapsed().as_secs_f64();
        metrics.poll_latency_seconds.observe(poll_elapsed);

        let mut cycle_success = false;
        for result in results {
            match result {
                Ok((response, req_side, req_chain_id)) => {
                    match OndoQuote::from_api_response(response, &req_side, &req_chain_id, polled_at) {
                        Ok(quote) => {
                            metrics.record_quote(&quote);
                            if sender
                                .send_timeout(quote, Duration::from_secs(1))
                                .await
                                .is_err()
                            {
                                metrics
                                    .queue_drops
                                    .with_label_values(&[&token.symbol])
                                    .inc();
                            } else {
                                total_rows += 1;
                                interval_rows += 1;
                                cycle_success = true;
                            }
                        }
                        Err(err) => {
                            metrics
                                .poll_errors
                                .with_label_values(&[&token.symbol, "parse"])
                                .inc();
                            tracing::warn!(
                                symbol = %token.symbol,
                                error = ?err,
                                "failed to parse API response"
                            );
                        }
                    }
                }
                Err((symbol, side, size, err)) => {
                    metrics
                        .poll_requests
                        .with_label_values(&[&symbol, &side, &size, "error"])
                        .inc();
                    metrics
                        .poll_errors
                        .with_label_values(&[&symbol, "http"])
                        .inc();
                    tracing::warn!(
                        symbol = %symbol,
                        side = %side,
                        size = %size,
                        error = ?err,
                        "API poll failed"
                    );
                }
            }
        }

        if cycle_success {
            health.set_market_seen(&token.symbol);
        }

        if last_log.elapsed() >= Duration::from_secs(5) {
            tracing::info!(
                symbol = %token.symbol,
                interval_rows = interval_rows,
                total_rows = total_rows,
                rows_per_second = interval_rows as f64 / last_log.elapsed().as_secs_f64().max(1e-9),
                "poll throughput"
            );
            interval_rows = 0;
            last_log = Instant::now();
        }
    }

    tracing::info!(symbol = %token.symbol, total_rows = total_rows, "poller stopped");
}

/// Returns (response, request_side, request_chain_id) on success,
/// since the API returns numeric encodings for side/chainId that we
/// want to replace with our human-readable request values.
async fn poll_once(
    http_client: reqwest::Client,
    api_url: String,
    api_key: String,
    request: OndoApiRequest,
) -> Result<(OndoApiResponse, String, String), (String, String, String, anyhow::Error)> {
    let symbol = request.symbol.clone();
    let side = request.side.clone();
    let size = request.token_amount.clone();
    let chain_id = request.chain_id.clone();

    let response = http_client
        .post(&api_url)
        .header("x-api-key", &api_key)
        .json(&request)
        .send()
        .await
        .map_err(|err| (symbol.clone(), side.clone(), size.clone(), err.into()))?;

    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "<unreadable>".to_string());
        return Err((
            symbol,
            side,
            size,
            anyhow::anyhow!("API returned {status}: {body}"),
        ));
    }

    let api_response = response
        .json::<OndoApiResponse>()
        .await
        .map_err(|err| (symbol, side.clone(), size, err.into()))?;

    Ok((api_response, side, chain_id))
}
