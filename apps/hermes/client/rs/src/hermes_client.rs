use std::time::Duration;

use reqwest::{Client, ClientBuilder};
use serde::{Deserialize, Serialize};
use url::Url;

use crate::{
    error::PriceServiceError,
    types::{AssetType, PriceFeedMetadata},
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


    encoding: Option<EncodingType>,
    parsed: Option<bool>,
    allow_unordered: Option<bool>,
    benchmark_only: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum EncodingType {
    Hex,
    Base64,
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
}
