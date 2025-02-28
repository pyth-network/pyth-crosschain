/// Hermes Integration
///
/// This module provides integration with the Hermes API for fetching price updates to fulfill Pulse requests.
///
/// # Overview
///
/// The Hermes API is used to fetch price updates for specific price IDs at a given publish time.
/// These updates are then used to execute callbacks on the Pulse contract.
///
/// # API Endpoints
///
/// The main endpoint used is:
///
/// GET /v2/updates/price/{publish_time}
///
/// This endpoint returns price updates for the specified price IDs at the given publish time.
///
/// ## Parameters
///
/// - `publish_time`: The timestamp for which to fetch price updates
/// - `ids`: Comma-separated list of price IDs (hex-encoded)
///
/// ## Response
///
/// The response contains binary data that can be passed directly to the `executeCallback` function on the Pulse contract:
///
/// {
///   "binary": {
///     "data": ["0x..."],
///     "encoding": "hex"
///   }
/// }
///
use {
    anyhow::{anyhow, Result},
    ethers::types::Bytes,
    reqwest::Client,
    serde::{Deserialize, Serialize},
    std::{env, time::Duration},
    tracing,
};

const HERMES_BASE_URL: &str = "https://hermes.pyth.network";
const HERMES_ENV_VAR: &str = "HERMES_BASE_URL";
const HERMES_TIMEOUT: Duration = Duration::from_secs(10);

/// Binary data response from Hermes API
#[derive(Debug, Serialize, Deserialize)]
pub struct BinaryData {
    pub data: Vec<String>,
    pub encoding: String,
}

/// Response from Hermes API for price updates
#[derive(Debug, Serialize, Deserialize)]
pub struct HermesResponse {
    pub binary: BinaryData,
}

/// Client for interacting with the Hermes API
///
/// This client provides a simple interface for fetching price updates from the Hermes API.
/// It handles:
///
/// - Converting price IDs to the correct format
/// - Making HTTP requests to the Hermes API
/// - Parsing the response and converting it to the format expected by the Pulse contract
/// - Error handling and retries
pub struct HermesClient {
    client: Client,
    base_url: String,
}

impl HermesClient {
    /// Create a new Hermes client with the base URL from environment variable or default
    pub fn new() -> Self {
        // Create a default config with the default base URL
        let default_config = crate::config::HermesConfig {
            base_url: HERMES_BASE_URL.to_string(),
        };
        Self::from_config(&default_config)
    }

    /// Create a new Hermes client with the base URL from the config
    pub fn from_config(config: &crate::config::HermesConfig) -> Self {
        // Environment variable takes precedence over config
        let base_url = env::var(HERMES_ENV_VAR).unwrap_or_else(|_| config.base_url.clone());
        Self::with_base_url(base_url)
    }

    /// Create a new Hermes client with a custom base URL
    pub fn with_base_url(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(HERMES_TIMEOUT)
            .build()
            .expect("Failed to build HTTP client");

        Self { client, base_url }
    }

    /// Fetch price updates for the given price IDs at the specified publish time
    ///
    /// Returns the binary update data that can be passed to the executeCallback function
    pub async fn get_price_updates(
        &self,
        publish_time: u64,
        price_ids: &[[u8; 32]],
    ) -> Result<Vec<Bytes>> {
        let price_ids_hex: Vec<String> = price_ids
            .iter()
            .map(|id| format!("0x{}", hex::encode(id)))
            .collect();

        let url = format!("{}/v2/updates/price/{}", self.base_url, publish_time);

        tracing::debug!(
            "Fetching price updates from Hermes for publish_time={} price_ids={:?}",
            publish_time,
            price_ids_hex
        );

        let response = self
            .client
            .get(&url)
            .query(&[("ids", price_ids_hex.join(","))])
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await?;
            return Err(anyhow!(
                "Failed to fetch price updates: status={}, body={}",
                status,
                text
            ));
        }

        let hermes_response: HermesResponse = response.json().await?;

        // Convert hex-encoded strings to bytes
        let update_data = hermes_response
            .binary
            .data
            .into_iter()
            .map(|hex_str| {
                let hex_str = hex_str.trim_start_matches("0x");
                let bytes = hex::decode(hex_str)
                    .map_err(|e| anyhow!("Failed to decode hex string: {}", e))?;
                Ok(Bytes::from(bytes))
            })
            .collect::<Result<Vec<Bytes>>>()?;

        tracing::debug!(
            "Received {} update data entries from Hermes",
            update_data.len()
        );

        Ok(update_data)
    }
}

impl Default for HermesClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Fetch price updates from Hermes for the given price IDs at the specified publish time
///
/// This function handles retries and error handling for Hermes API requests
#[tracing::instrument(skip_all, fields(publish_time))]
pub async fn fetch_price_updates_from_hermes(
    publish_time: u64,
    price_ids: &[[u8; 32]],
) -> Result<Vec<Bytes>> {
    const MAX_RETRIES: usize = 3;
    const RETRY_DELAY: std::time::Duration = std::time::Duration::from_millis(500);

    // Use HermesClient::new() which will read from environment variables if available
    let hermes_client = HermesClient::new();
    let mut last_error = None;

    for retry in 0..MAX_RETRIES {
        match hermes_client
            .get_price_updates(publish_time, price_ids)
            .await
        {
            Ok(update_data) => {
                if update_data.is_empty() {
                    tracing::warn!(
                        "Hermes returned empty update data for publish_time={}",
                        publish_time
                    );
                    return Err(anyhow!("Hermes returned empty update data"));
                }

                tracing::info!(
                    "Successfully fetched price updates from Hermes: {} entries",
                    update_data.len()
                );
                return Ok(update_data);
            }
            Err(e) => {
                last_error = Some(e);
                if retry < MAX_RETRIES - 1 {
                    tracing::warn!(
                        "Failed to fetch price updates from Hermes (retry {}/{}): {:?}",
                        retry + 1,
                        MAX_RETRIES,
                        last_error
                    );
                    tokio::time::sleep(RETRY_DELAY).await;
                }
            }
        }
    }

    Err(anyhow!(
        "Failed to fetch price updates from Hermes after {} retries: {:?}",
        MAX_RETRIES,
        last_error
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::{self, Matcher};

    #[tokio::test]
    async fn test_get_price_updates_success() {
        // Setup mock server
        let mut mock_server = mockito::Server::new_async().await;
        let url = mock_server.url();

        // Create a test price ID
        let price_id = [
            0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab,
            0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78,
            0x90, 0xab, 0xcd, 0xef,
        ];

        // Create a mock for the Hermes API endpoint
        let mock = mock_server
            .mock("GET", "/v2/updates/price/1234567890")
            .match_query(Matcher::UrlEncoded(
                "ids".into(),
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef".into(),
            ))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{
                "binary": {
                    "data": ["0xabcdef1234567890", "0x123456"],
                    "encoding": "hex"
                }
            }"#,
            )
            .create_async()
            .await;

        // Create a client with the mock server URL
        let client = HermesClient::with_base_url(url);

        // Call the method
        let result = client.get_price_updates(1234567890, &[price_id]).await;

        // Verify the result
        assert!(result.is_ok());
        let updates = result.unwrap();
        assert_eq!(updates.len(), 2);

        // Check the first update data
        let expected_data1 = hex::decode("abcdef1234567890").unwrap();
        assert_eq!(updates[0].to_vec(), expected_data1);

        // Check the second update data
        let expected_data2 = hex::decode("123456").unwrap();
        assert_eq!(updates[1].to_vec(), expected_data2);

        // Verify the mock was called
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_get_price_updates_error_response() {
        // Setup mock server
        let mut mock_server = mockito::Server::new_async().await;
        let url = mock_server.url();

        // Create a test price ID
        let price_id = [
            0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab,
            0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78,
            0x90, 0xab, 0xcd, 0xef,
        ];

        // Create a mock for the Hermes API endpoint with an error response
        let mock = mock_server
            .mock("GET", "/v2/updates/price/1234567890")
            .match_query(Matcher::UrlEncoded(
                "ids".into(),
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef".into(),
            ))
            .with_status(404)
            .with_body("Not found")
            .create_async()
            .await;

        // Create a client with the mock server URL
        let client = HermesClient::with_base_url(url);

        // Call the method
        let result = client.get_price_updates(1234567890, &[price_id]).await;

        // Verify the result is an error
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(error.to_string().contains("Failed to fetch price updates"));

        // Verify the mock was called
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_get_price_updates_empty_response() {
        // Setup mock server
        let mut mock_server = mockito::Server::new_async().await;
        let url = mock_server.url();

        // Create a test price ID
        let price_id = [
            0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab,
            0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78,
            0x90, 0xab, 0xcd, 0xef,
        ];

        // Create a mock for the Hermes API endpoint with an empty data array
        let mock = mock_server
            .mock("GET", "/v2/updates/price/1234567890")
            .match_query(Matcher::UrlEncoded(
                "ids".into(),
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef".into(),
            ))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{
                "binary": {
                    "data": [],
                    "encoding": "hex"
                }
            }"#,
            )
            .create_async()
            .await;

        // Create a client with the mock server URL
        let client = HermesClient::with_base_url(url);

        // Call the method
        let result = client.get_price_updates(1234567890, &[price_id]).await;

        // Verify the result
        assert!(result.is_ok());
        let updates = result.unwrap();
        assert_eq!(updates.len(), 0);

        // Verify the mock was called
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_get_price_updates_invalid_hex() {
        // Setup mock server
        let mut mock_server = mockito::Server::new_async().await;
        let url = mock_server.url();

        // Create a test price ID
        let price_id = [
            0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab,
            0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78,
            0x90, 0xab, 0xcd, 0xef,
        ];

        // Create a mock for the Hermes API endpoint with invalid hex data
        let mock = mock_server
            .mock("GET", "/v2/updates/price/1234567890")
            .match_query(Matcher::UrlEncoded(
                "ids".into(),
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef".into(),
            ))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{
                "binary": {
                    "data": ["0xZZZZ"],
                    "encoding": "hex"
                }
            }"#,
            )
            .create_async()
            .await;

        // Create a client with the mock server URL
        let client = HermesClient::with_base_url(url);

        // Call the method
        let result = client.get_price_updates(1234567890, &[price_id]).await;

        // Verify the result is an error about invalid hex
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(error.to_string().contains("Failed to decode hex string"));

        // Verify the mock was called
        mock.assert_async().await;
    }
}
