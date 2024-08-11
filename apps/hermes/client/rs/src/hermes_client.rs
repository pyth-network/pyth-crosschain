use std::time::Duration;

use chrono::{DateTime, Utc};
use futures_util::{Stream, StreamExt};
use hermes_types::{AssetType, EncodingType, PriceFeedMetadata, PriceUpdate};
use reqwest::{Client, ClientBuilder};
use serde::Serialize;
use url::Url;

use crate::error::HermesClientError;

const DEFAULT_TIMEOUT: u64 = 5000;

#[derive(Debug)]
pub struct HermesClientConfig {
    /// Timeout of each request (for all of retries). Default: 5000ms
    timeout: Option<Duration>,
}

impl HermesClientConfig {
    pub fn new(timeout: Option<Duration>) -> Self {
        Self { timeout }
    }
}

#[derive(Debug)]
pub struct HermesClient {
    http_client: Client,
    base_url: Url,
}

#[derive(Debug, Serialize)]
pub struct ParamOption {
    /// Optional query parameter. If provided, the results will be filtered to all price feeds whose symbol contains the query string. Query string is case insensitive.
    query: Option<String>,

    /// Optional query parameter. If provided, the results will be filtered by asset type. Possible values are crypto, equity, fx, metal, rates. Filter string is case insensitive.
    asset_type: Option<AssetType>,

    // filter: Option<String>,

    // Optional encoding type. If true, return the price update in the encoding specified by the encoding parameter. Default is `hex`.
    //
    // Available values : hex, base64
    encoding: Option<EncodingType>,

    /// If true, include the parsed price update in the `parsed` field of each returned feed. Default is `true`.
    parsed: Option<bool>,

    /// If true, allows unordered price updates to be included in the stream.
    allow_unordered: Option<bool>,

    /// If true, only include benchmark prices that are the initial price updates at a given timestamp (i.e., prevPubTime != pubTime).
    benchmark_only: Option<bool>,
}

impl ParamOption {
    pub fn new(
        query: Option<String>,
        asset_type: Option<AssetType>,
        encoding: Option<EncodingType>,
        parsed: Option<bool>,
        allow_unordered: Option<bool>,
        benchmark_only: Option<bool>,
    ) -> Self {
        Self {
            query,
            asset_type,
            encoding,
            parsed,
            allow_unordered,
            benchmark_only,
        }
    }
}

impl HermesClient {
    ///  Constructs a new Connection
    pub fn new(
        endpoint: &str,
        config: Option<HermesClientConfig>,
    ) -> Result<Self, HermesClientError> {
        let timeout = match config {
            Some(config) => config
                .timeout
                .unwrap_or(Duration::from_millis(DEFAULT_TIMEOUT)),
            None => Duration::from_millis(DEFAULT_TIMEOUT),
        };

        let base_url = Url::parse(endpoint)?;
        let http_client = ClientBuilder::new().timeout(timeout).build()?;

        Ok(Self {
            http_client,
            base_url,
        })
    }

    /// Fetch the set of available price feeds.
    /// This endpoint can be filtered by asset type and query string.
    /// This will throw an error if there is a network problem or the price service returns a non-ok response.
    pub async fn get_price_feeds(
        &self,
        options: Option<ParamOption>,
    ) -> Result<Vec<PriceFeedMetadata>, HermesClientError> {
        let mut url = self.base_url.clone();
        url.set_path("v2/price_feeds");

        let response = self.http_client.get(url).query(&options).send().await?;
        let price_feed_meta_json = response.json::<Vec<PriceFeedMetadata>>().await?;

        Ok(price_feed_meta_json)
    }

    /// Fetch the latest price updates for a set of price feed IDs.
    /// This endpoint can be customized by specifying the encoding type and whether the results should also return the parsed price update using the options object.
    /// This will throw an error if there is a network problem or the price service returns a non-ok respon
    pub async fn get_latest_price_updates(
        &self,
        ids: &[&str],
        options: Option<ParamOption>,
    ) -> Result<PriceUpdate, HermesClientError> {
        let mut url = self.base_url.clone();
        url.set_path("v2/updates/price/latest");

        let mut params = Vec::new();
        for price_id in ids {
            params.push(("ids[]", price_id.to_string()));
        }
        let response = self
            .http_client
            .get(url)
            .query(&params)
            .query(&options)
            .send()
            .await?;
        let price_update_json = response.json::<PriceUpdate>().await?;

        Ok(price_update_json)
    }

    /// Fetch the price updates for a set of price feed IDs at a given timestamp.
    /// This endpoint can be customized by specifying the encoding type and whether the results should also return the parsed price update.
    /// This will throw an error if there is a network problem or the price service returns a non-ok response.
    pub async fn get_price_updates_at_timestamp(
        &self,
        publish_time: DateTime<Utc>,
        ids: &[&str],
        options: Option<ParamOption>,
    ) -> Result<PriceUpdate, HermesClientError> {
        let path = format!("v2/updates/price/{}", publish_time.timestamp());
        let mut url = self.base_url.clone();
        url.set_path(&path);

        let mut params = Vec::new();
        for price_id in ids {
            params.push(("ids[]", price_id.to_string()));
        }
        let response = self
            .http_client
            .get(url)
            .query(&params)
            .query(&options)
            .send()
            .await?;
        let price_update_json = response.json::<PriceUpdate>().await?;

        Ok(price_update_json)
    }

    /// Fetch streaming price updates for a set of price feed IDs.
    /// This endpoint can be customized by specifying the encoding type, whether the results should include parsed updates,
    /// and if unordered updates or only benchmark updates are allowed.
    pub fn get_price_updates_stream(
        &self,
        ids: &[&str],
        options: Option<ParamOption>,
    ) -> impl Stream<Item = Result<PriceUpdate, HermesClientError>> {
        let mut url = self.base_url.clone();
        url.set_path("v2/updates/price/stream");

        let mut params = Vec::new();
        for price_id in ids {
            params.push(("ids[]", price_id.to_string()));
        }

        let request = self
            .http_client
            .get(url)
            .header("Accept", "text/event-stream")
            .query(&params)
            .query(&options);

        let stream = async_stream::stream! {
            let mut buffer = Vec::new();
            let response =match request.send().await {
                Ok(response) => response,
                Err(e) => {
                    yield Err(HermesClientError::RError(e));
                    return;
                }
            };

            let mut stream = response.bytes_stream();

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        buffer.extend_from_slice(&bytes);

                        if let Some(pos) = buffer.windows(2).position(|window| window == b"\n\n") {
                            let (complete_data, rest) = buffer.split_at(pos + 2);
                            let data_str = &complete_data[5..]; // Strip the "data:" prefix
                            match serde_json::from_slice::<PriceUpdate>(data_str) {
                                Ok(price_update) => {
                                    yield Ok(price_update);
                                }
                                Err(e) => {
                                   yield  Err(HermesClientError::Json(e));
                                   break;
                                }
                            }
                            buffer = rest.to_vec();
                        }
                    }
                    Err(e) => yield Err(HermesClientError::RError(e)),
                }
            }
        };

        stream
    }
}
