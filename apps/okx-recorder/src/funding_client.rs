use std::{collections::HashMap, time::Duration};

use chrono::Utc;
use tokio_util::sync::CancellationToken;

use crate::{
    metrics::RecorderMetrics,
    models::{parse_funding_history, FundingRate},
};

/// Poll the settled funding-rate history once for every configured instrument
/// and return the combined batch. Mirrors `hyperliquid-recorder`'s
/// `poll_funding_once`: a failed instrument is skipped (with a jittered
/// per-instrument backoff before the next one) rather than failing the whole
/// poll, so one delisted instrument cannot starve the others. Overlap with
/// previously recorded windows is expected — the sink is idempotent by
/// `(inst_id, funding_time)`.
#[allow(clippy::too_many_arguments)]
pub async fn poll_funding_once(
    http: &reqwest::Client,
    history_url: &str,
    instruments: &[String],
    history_limit: u32,
    max_backoff_seconds: u64,
    metrics: &RecorderMetrics,
    backoff: &mut HashMap<String, u64>,
    stop_token: &CancellationToken,
) -> Vec<FundingRate> {
    let mut batch: Vec<FundingRate> = Vec::new();

    for inst_id in instruments {
        if stop_token.is_cancelled() {
            return batch;
        }

        match fetch_funding_history(http, history_url, inst_id, history_limit).await {
            Ok(body) => {
                let received_at = Utc::now();
                match parse_funding_history(&body, inst_id, received_at) {
                    Ok(rows) => {
                        tracing::debug!(
                            inst_id = %inst_id,
                            rows = rows.len(),
                            "funding-rate-history poll ok"
                        );
                        metrics
                            .funding_poll_attempts
                            .with_label_values(&[inst_id, "success"])
                            .inc();
                        backoff.insert(inst_id.clone(), 1);
                        batch.extend(rows);
                    }
                    Err(err) => {
                        tracing::warn!(
                            inst_id = %inst_id,
                            error = ?err,
                            "funding-rate-history parse error"
                        );
                        metrics
                            .funding_poll_attempts
                            .with_label_values(&[inst_id, "error"])
                            .inc();
                        sleep_backoff(backoff, inst_id, max_backoff_seconds).await;
                    }
                }
            }
            Err(err) => {
                tracing::warn!(
                    inst_id = %inst_id,
                    error = ?err,
                    "funding-rate-history request failed"
                );
                metrics
                    .funding_poll_attempts
                    .with_label_values(&[inst_id, "error"])
                    .inc();
                sleep_backoff(backoff, inst_id, max_backoff_seconds).await;
            }
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    batch
}

async fn fetch_funding_history(
    http: &reqwest::Client,
    url: &str,
    inst_id: &str,
    limit: u32,
) -> anyhow::Result<String> {
    let response = http
        .get(url)
        .query(&[("instId", inst_id), ("limit", &limit.to_string())])
        .send()
        .await?;
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        anyhow::bail!("funding-rate-history request failed ({status}): {body}");
    }
    Ok(body)
}

async fn sleep_backoff(
    backoff: &mut HashMap<String, u64>,
    inst_id: &str,
    max_backoff_seconds: u64,
) {
    let current = backoff.get(inst_id).copied().unwrap_or(1);
    let jittered_ms = fastrand::u64(0..=current.saturating_mul(1000));
    tokio::time::sleep(Duration::from_millis(jittered_ms)).await;
    let next = current.saturating_mul(2).min(max_backoff_seconds.max(1));
    backoff.insert(inst_id.to_string(), next);
}
