use std::{
    collections::HashMap,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tokio::{
    sync::mpsc,
    time::{interval, MissedTickBehavior},
};
use tokio_util::sync::CancellationToken;

use crate::models::{parse_funding_history, FundingRateRecord, MarketSubscription};

#[allow(clippy::too_many_arguments)]
pub async fn run_funding_poll_worker(
    info_api_url: String,
    markets: Vec<MarketSubscription>,
    poll_seconds: u64,
    lookback_seconds: u64,
    max_backoff_seconds: u64,
    sender: mpsc::Sender<FundingRateRecord>,
    stop_token: CancellationToken,
) {
    let http = reqwest::Client::new();
    let mut backoff: HashMap<String, u64> = HashMap::new();

    let mut ticker = interval(Duration::from_secs(poll_seconds.max(1)));
    ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);

    while !stop_token.is_cancelled() {
        ticker.tick().await;
        if stop_token.is_cancelled() {
            return;
        }

        for market in &markets {
            if stop_token.is_cancelled() {
                return;
            }
            let coin = market.coin.clone();
            let start_time_ms = now_unix_ms().saturating_sub(lookback_seconds.saturating_mul(1000));

            match fetch_funding_history(&http, &info_api_url, &coin, start_time_ms).await {
                Ok(body) => match parse_funding_history(&body, &coin, &info_api_url) {
                    Ok(records) => {
                        tracing::info!(
                            coin = %coin,
                            rows = records.len(),
                            start_time_ms,
                            "fundingHistory poll ok"
                        );
                        backoff.insert(coin.clone(), 1);
                        for record in records {
                            if tokio::time::timeout(
                                Duration::from_secs(1),
                                sender.send(record),
                            )
                            .await
                            .is_err()
                            {
                                tracing::warn!(coin = %coin, "funding queue drop");
                            }
                        }
                    }
                    Err(err) => {
                        tracing::warn!(coin = %coin, error = ?err, "fundingHistory parse error");
                        sleep_backoff(&mut backoff, &coin, max_backoff_seconds).await;
                    }
                },
                Err(err) => {
                    tracing::warn!(coin = %coin, error = ?err, "fundingHistory request failed");
                    sleep_backoff(&mut backoff, &coin, max_backoff_seconds).await;
                }
            }

            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }
}

#[derive(Serialize)]
struct FundingHistoryRequest<'a> {
    #[serde(rename = "type")]
    request_type: &'a str,
    coin: &'a str,
    #[serde(rename = "startTime")]
    start_time: u64,
}

async fn fetch_funding_history(
    http: &reqwest::Client,
    url: &str,
    coin: &str,
    start_time_ms: u64,
) -> anyhow::Result<String> {
    let request = FundingHistoryRequest {
        request_type: "fundingHistory",
        coin,
        start_time: start_time_ms,
    };
    let response = http.post(url).json(&request).send().await?;
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        anyhow::bail!("fundingHistory request failed ({status}): {body}");
    }
    Ok(body)
}

async fn sleep_backoff(
    backoff: &mut HashMap<String, u64>,
    coin: &str,
    max_backoff_seconds: u64,
) {
    let current = backoff.get(coin).copied().unwrap_or(1);
    tokio::time::sleep(Duration::from_secs(current)).await;
    let next = current.saturating_mul(2).min(max_backoff_seconds.max(1));
    backoff.insert(coin.to_string(), next);
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
