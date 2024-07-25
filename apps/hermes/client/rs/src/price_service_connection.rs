use std::{collections::HashMap, time::Duration};

use chrono::{DateTime, Timelike, Utc};
use pyth_sdk::PriceFeed;
use reqwest::{Client, ClientBuilder, StatusCode, Url};
use serde::Deserialize;

use crate::error::PriceServiceError;

#[derive(Debug, Default)]
pub struct PriceFeedRequestConfig {
    /// Optional verbose to request for verbose information from the service
    verbose: Option<bool>,

    /// Optional binary to include the price feeds binary update data
    binary: Option<bool>,

    /// Optional config for the websocket subscription to receive out of order updates
    allow_out_of_order: Option<bool>,
}

#[derive(Debug, Default)]
pub struct PriceServiceConnectionConfig {
    /// Timeout of each request (for all of retries). Default: 5000ms
    timeout: Option<Duration>,

    /// Number of times a HTTP request will be retried before the API returns a failure. Default: 3.
    ///
    /// The connection uses exponential back-off for the delay between retries. However,
    /// it will timeout regardless of the retries at the configured `timeout` time.
    ///
    /// In the future, will use retry: https://github.com/seanmonstar/reqwest/issues/799
    // http_retries: Option<u8>,

    /// Deprecated: please use priceFeedRequestConfig.verbose instead
    verbose: Option<bool>,

    /// Configuration for the price feed requests
    price_feed_request_config: Option<PriceFeedRequestConfig>,
}

#[derive(Debug, Deserialize)]
pub struct VaaResponse {
    #[serde(rename = "publishTime")]
    pub publish_time: i64,
    pub vaa: String,
}

pub struct PriceServiceConnection {
    http_client: Client,
    base_url: Url,
    price_feed_request_config: PriceFeedRequestConfig,
}

impl PriceServiceConnection {
    pub fn new(
        endpoint: &str,
        config: Option<PriceServiceConnectionConfig>,
    ) -> Result<Self, PriceServiceError> {
        let price_feed_request_config: PriceFeedRequestConfig;
        let timeout: Duration;

        match config {
            Some(ref price_service_config) => {
                if let Some(ref config) = price_service_config.price_feed_request_config {
                    let verbose = match config.verbose {
                        Some(config_verbose) => Some(config_verbose),
                        None => price_service_config.verbose,
                    };

                    price_feed_request_config = PriceFeedRequestConfig {
                        binary: config.binary,
                        verbose,
                        allow_out_of_order: config.allow_out_of_order,
                    }
                } else {
                    price_feed_request_config = PriceFeedRequestConfig {
                        binary: None,
                        verbose: price_service_config.verbose,
                        allow_out_of_order: None,
                    }
                }

                timeout = price_service_config
                    .timeout
                    .unwrap_or(Duration::from_millis(5000));
            }
            None => {
                price_feed_request_config = PriceFeedRequestConfig {
                    binary: None,
                    verbose: None,
                    allow_out_of_order: None,
                };

                timeout = Duration::from_millis(5000);
            }
        };

        let base_url = Url::parse(endpoint)?;

        let mut ws_endpoint = base_url.clone();
        match base_url.scheme() {
            "http" => ws_endpoint.set_scheme("ws").unwrap(),
            "https" => ws_endpoint.set_scheme("wss").unwrap(),
            _ => {
                return Err(PriceServiceError::BadUrl(
                    url::ParseError::InvalidIpv4Address,
                ))
            }
        };

        let http_client = ClientBuilder::new().timeout(timeout).build()?;

        Ok(Self {
            http_client,
            base_url,
            price_feed_request_config,
        })
    }

    /// Fetch Latest PriceFeeds of given price ids.
    /// This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price ids)
    pub async fn get_latest_price_feeds(
        &self,
        price_ids: &[&str],
    ) -> Result<Vec<PriceFeed>, PriceServiceError> {
        if price_ids.is_empty() {
            return Ok(vec![]);
        }

        let mut params = Vec::new();
        for price_id in price_ids {
            params.push(("ids[]", price_id.to_string()));
        }
        let verbose = match self.price_feed_request_config.verbose {
            Some(verbose) => verbose,
            None => true,
        };
        params.push(("verbose", verbose.to_string()));

        let binary = match self.price_feed_request_config.binary {
            Some(binary) => binary,
            None => true,
        };
        params.push(("binary", binary.to_string()));

        let url = match self.base_url.join("/api/latest_price_feeds") {
            Ok(url) => url,
            Err(e) => return Err(PriceServiceError::BadUrl(e)),
        };
        let response = self.http_client.get(url).query(&params).send().await?;
        let price_feed_json = response.json::<Vec<PriceFeed>>().await?;

        Ok(price_feed_json)
    }

    /// Fetch latest VAA of given price ids.
    /// This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price ids)
    ///
    /// This function is coupled to wormhole implemntation.
    pub async fn get_latest_vass(
        &self,
        price_ids: &[&str],
    ) -> Result<Vec<String>, PriceServiceError> {
        if price_ids.is_empty() {
            return Ok(vec![]);
        }

        let mut params = HashMap::new();
        for price_id in price_ids {
            params.insert("ids[]", price_id.to_string());
        }

        let url = match self.base_url.join("/api/latest_vaas") {
            Ok(url) => url,
            Err(e) => return Err(PriceServiceError::BadUrl(e)),
        };
        let response = self.http_client.get(url).query(&params).send().await?;

        let vaas = response.json::<Vec<String>>().await?;
        Ok(vaas)
    }

    /// Fetch the earliest VAA of the given price id that is published since the given publish time.
    /// This will throw an error if the given publish time is in the future, or if the publish time
    /// is old and the price service endpoint does not have a db backend for historical requests.
    /// This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price id)
    ///
    /// This function is coupled to wormhole implemntation.
    pub async fn get_vaa(
        &self,
        price_id: &str,
        publish_time: DateTime<Utc>,
    ) -> Result<VaaResponse, PriceServiceError> {
        let mut params = HashMap::new();
        params.insert("id", price_id.to_string());
        params.insert("publish_time", publish_time.timestamp().to_string());

        let url = match self.base_url.join("/api/get_vaa") {
            Ok(url) => url,
            Err(e) => return Err(PriceServiceError::BadUrl(e)),
        };
        let response = self.http_client.get(url).query(&params).send().await?;

        match response.status() {
            StatusCode::OK => {
                let vaa = response.json::<VaaResponse>().await?;

                Ok(vaa)
            }
            _status => {
                let err_str = response.json::<String>().await?;

                Err(PriceServiceError::NotJson(err_str))
            }
        }
    }

    /// Fetch the PriceFeed of the given price id that is published since the given publish time.
    /// This will throw an error if the given publish time is in the future, or if the publish time
    /// is old and the price service endpoint does not have a db backend for historical requests.
    /// This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price id)
    pub async fn get_price_feed(
        &self,
        price_id: &str,
        publish_time: DateTime<Utc>,
    ) -> Result<PriceFeed, PriceServiceError> {
        let mut params = HashMap::new();
        params.insert("id", price_id.to_string());
        params.insert("publish_time", publish_time.second().to_string());

        let verbose = match self.price_feed_request_config.verbose {
            Some(verbose) => verbose,
            None => true,
        };
        params.insert("verbose", verbose.to_string());

        let binary = match self.price_feed_request_config.binary {
            Some(binary) => binary,
            None => true,
        };
        params.insert("binary", binary.to_string());

        let url = match self.base_url.join("/api/get_price_feed") {
            Ok(url) => url,
            Err(e) => return Err(PriceServiceError::BadUrl(e)),
        };
        let response = self.http_client.get(url).query(&params).send().await?;

        match response.status() {
            StatusCode::OK => {
                let price_feed_json = response.json::<PriceFeed>().await?;
                Ok(price_feed_json)
            }
            _status => {
                let err_str = response.json::<String>().await?;

                Err(PriceServiceError::NotJson(err_str))
            }
        }
    }

    /// Fetch the list of available price feed ids.
    /// This will throw an axios error if there is a network problem or the price service returns a non-ok response.
    pub async fn get_price_feed_ids(&self) -> Result<Vec<String>, PriceServiceError> {
        let url = match self.base_url.join("/api/price_feed_ids") {
            Ok(url) => url,
            Err(e) => return Err(PriceServiceError::BadUrl(e)),
        };
        let response = self
            .http_client
            .get(url)
            .send()
            .await
            .expect("Send request");

        let price_feed_json = response.json::<Vec<String>>().await?;

        Ok(price_feed_json)
    }
}

#[cfg(test)]
mod tests {
    use chrono::Duration;

    // use crate::types::RpcPriceIdentifier;

    use super::*;

    const ENDPOINT: &str = "https://hermes.pyth.network";

    // type Cb = fn(RpcPriceFeed);

    #[tokio::test]
    async fn test_http_endpoints() {
        let connection: PriceServiceConnection =
            PriceServiceConnection::new(ENDPOINT, None).expect("Failed to construct");

        let ids = connection
            .get_price_feed_ids()
            .await
            .expect("Failed to get price feed ids");
        assert!(!ids.is_empty());

        let price_ids: Vec<&str> = ids[0..2].iter().map(|price_id| price_id.as_str()).collect();
        let price_feeds = connection.get_latest_price_feeds(&price_ids).await;
        assert!(price_feeds.is_ok());

        let price_feeds = price_feeds.unwrap();
        assert_eq!(price_feeds.len(), 2);
    }

    #[tokio::test]
    async fn test_get_price_feed_with_verbose_flag_works() {
        let price_service_connection_config = PriceServiceConnectionConfig {
            timeout: None,
            verbose: Some(true),
            price_feed_request_config: None,
        };
        let connection: PriceServiceConnection =
            PriceServiceConnection::new(ENDPOINT, Some(price_service_connection_config))
                .expect("Failed to construct");

        let ids = connection
            .get_price_feed_ids()
            .await
            .expect("Failed to get price feed ids");
        assert!(!ids.is_empty());

        let price_ids: Vec<&str> = ids[0..2].iter().map(|price_id| price_id.as_str()).collect();
        let price_feeds = connection.get_latest_price_feeds(&price_ids).await;
        assert!(price_feeds.is_ok());

        let price_feeds = price_feeds.unwrap();
        assert_eq!(price_feeds.len(), 2);
    }

    #[tokio::test]
    async fn test_get_price_feed_with_binary_flag_works() {
        let price_feed_request_config = PriceFeedRequestConfig {
            verbose: None,
            binary: Some(true),
            allow_out_of_order: None,
        };
        let price_service_connection_config = PriceServiceConnectionConfig {
            timeout: None,
            verbose: None,
            price_feed_request_config: Some(price_feed_request_config),
        };
        let connection: PriceServiceConnection =
            PriceServiceConnection::new(ENDPOINT, Some(price_service_connection_config))
                .expect("Failed to construct");

        let ids = connection
            .get_price_feed_ids()
            .await
            .expect("Failed to get price feed ids");
        assert!(!ids.is_empty());

        let price_ids: Vec<&str> = ids[0..2].iter().map(|price_id| price_id.as_str()).collect();
        let price_feeds = connection.get_latest_price_feeds(&price_ids).await;
        assert!(price_feeds.is_ok());

        let price_feeds = price_feeds.unwrap();
        assert_eq!(price_feeds.len(), 2);
    }

    #[tokio::test]
    async fn test_get_latest_vaa_works() {
        let price_feed_request_config = PriceFeedRequestConfig {
            verbose: None,
            binary: Some(true),
            allow_out_of_order: None,
        };
        let price_service_connection_config = PriceServiceConnectionConfig {
            timeout: None,
            verbose: None,
            price_feed_request_config: Some(price_feed_request_config),
        };
        let connection: PriceServiceConnection =
            PriceServiceConnection::new(ENDPOINT, Some(price_service_connection_config))
                .expect("Failed to construct");

        let ids = connection
            .get_price_feed_ids()
            .await
            .expect("Failed to get price feed ids");
        assert!(!ids.is_empty());

        let price_ids: Vec<&str> = ids[0..2].iter().map(|price_id| price_id.as_str()).collect();
        let vaas = connection
            .get_latest_vass(&price_ids)
            .await
            .expect("Failed to get latest vaas");
        assert!(!vaas.is_empty());
    }

    #[tokio::test]
    async fn test_get_vaa_works() {
        let price_feed_request_config = PriceFeedRequestConfig {
            verbose: None,
            binary: Some(true),
            allow_out_of_order: None,
        };
        let price_service_connection_config = PriceServiceConnectionConfig {
            timeout: None,
            verbose: None,
            price_feed_request_config: Some(price_feed_request_config),
        };
        let connection: PriceServiceConnection =
            PriceServiceConnection::new(ENDPOINT, Some(price_service_connection_config))
                .expect("Failed to construct");

        let ids = connection
            .get_price_feed_ids()
            .await
            .expect("Failed to get latest vaas");
        assert!(!ids.is_empty());

        let publish_time_10_sec_ago = Utc::now() - Duration::seconds(10);
        let VaaResponse { publish_time, vaa } = connection
            .get_vaa(
                "19d75fde7fee50fe67753fdc825e583594eb2f51ae84e114a5246c4ab23aff4c",
                publish_time_10_sec_ago,
            )
            .await
            .expect("Failed to get latest vaas");
        assert!(!vaa.is_empty());
        assert!(publish_time >= publish_time_10_sec_ago.timestamp());
    }
}
