use crate::types::{HermesResponse, PriceUpdateResult, PriceUpdateResults, UnixTimestamp};
use crate::utils::error::BenchmarksKeeperError;
use alloy::hex;
use alloy::primitives::Bytes;
use reqwest::Client;
use std::collections::HashMap;

pub async fn fetch_price_data(
    client: &Client,
    hermes_url: &str,
    publish_time: UnixTimestamp,
    price_ids: &Vec<[u8; 32]>,
    client_context: Bytes,
) -> Result<PriceUpdateResults, BenchmarksKeeperError> {
    let url = format!("{}/v2/updates/price/{}", hermes_url, publish_time);
    let mut query_params = vec![];
    for id in price_ids {
        let hex_id = hex::encode(id);
        query_params.push(("ids[]", hex_id));
    }

    let response = client
        .get(&url)
        .query(&query_params)
        .send()
        .await
        .map_err(|e| {
            eprintln!("Request error: {:?}", e);
            BenchmarksKeeperError::HermesApiError(format!("Request failed: {}", e))
        })?;

    if !response.status().is_success() {
        return Err(BenchmarksKeeperError::HermesApiError(format!(
            "Hermes API returned status code: {}",
            response.status()
        )));
    }

    let hermes_data: HermesResponse = response
        .json()
        .await
        .map_err(|e| BenchmarksKeeperError::HermesApiError(e.to_string()))?;

    let mut result = HashMap::new();
    if let Some(parsed_updates) = hermes_data.parsed {
        for parsed_data in parsed_updates {
            result.insert(
                parsed_data.id.clone(),
                PriceUpdateResult {
                    price: parsed_data.price,
                    ema_price: parsed_data.ema_price,
                    metadata: parsed_data.metadata,
                },
            );
        }
    }

    Ok(PriceUpdateResults {
        results: result,
        client_context,
    })
}
