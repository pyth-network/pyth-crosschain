use std::time::Duration;

use hermes::api::types::{PriceFeedMetadata, PriceUpdate};
use reqwest::{Client, ClientBuilder};
use serde::Serialize;
use url::Url;

use crate::{
    error::PriceServiceError,
    types::{AssetType, EncodingType},
};

const DEFAULT_TIMEOUT: u64 = 5000;

#[derive(Debug)]
pub struct HermesClientConfig {
    /// Timeout of each request (for all of retries). Default: 5000ms
    timeout: Option<Duration>,
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

impl HermesClient {
    ///  Constructs a new Connection
    pub fn new(
        endpoint: &str,
        config: Option<HermesClientConfig>,
    ) -> Result<Self, PriceServiceError> {
        let timeout;

        match config {
            Some(config) => {
                timeout = config
                    .timeout
                    .unwrap_or(Duration::from_millis(DEFAULT_TIMEOUT));
            }
            None => {
                timeout = Duration::from_millis(DEFAULT_TIMEOUT);
            }
        }

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
    ) -> Result<Vec<PriceFeedMetadata>, PriceServiceError> {
        let url = self.base_url.clone();
        url.join("v2/price_feeds")?;

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
    ) -> Result<PriceUpdate, PriceServiceError> {
        let url = self.base_url.clone();
        url.join("v2/updates/price/latest")?;

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
}
