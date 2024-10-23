use crate::types::{HermesResponse, PriceUpdateResult, PriceUpdateResults, UnixTimestamp};
use crate::utils::error::BenchmarksKeeperError;
use alloy::hex;
use alloy::primitives::Bytes;
use reqwest::{Client, Url};
use std::collections::HashMap;

pub async fn fetch_price_data(
    client: &Client,
    hermes_url: &str,
    publish_time: UnixTimestamp,
    price_ids: &Vec<[u8; 32]>,
    client_context: Bytes,
) -> Result<PriceUpdateResults, BenchmarksKeeperError> {
    let base = format!("{}/v2/updates/price/{}", hermes_url, publish_time);
    let mut url = Url::parse(&base).map_err(|e| BenchmarksKeeperError::Other(e.into()))?;

    for id in price_ids {
        url.query_pairs_mut().append_pair("ids[]", &hex::encode(id));
    }

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| {
            eprintln!("Request error: {:?}", e);
            BenchmarksKeeperError::HermesApiError(format!("Request failed: {}", e))
        })?
        .error_for_status()
        .map_err(|e| BenchmarksKeeperError::HermesApiError(format!("Hermes API error: {}", e)))?;

    let hermes_data: HermesResponse = response
        .json()
        .await
        .map_err(|e| BenchmarksKeeperError::HermesApiError(e.to_string()))?;

    let parsed_updates = hermes_data.parsed.ok_or_else(|| {
        BenchmarksKeeperError::HermesApiError("No parsed updates received".to_string())
    })?;

    let mut result = HashMap::new();
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

    // Check if all requested price IDs are present
    let missing_ids: Vec<_> = price_ids
        .iter()
        .filter(|id| !result.contains_key(&hex::encode(id)))
        .collect();

    if !missing_ids.is_empty() {
        return Err(BenchmarksKeeperError::HermesApiError(format!(
            "Missing price updates for IDs: {:?}",
            missing_ids
        )));
    }

    Ok(PriceUpdateResults {
        results: result,
        client_context,
    })
}
