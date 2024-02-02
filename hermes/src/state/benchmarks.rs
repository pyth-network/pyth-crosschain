//! This module communicates with Pyth Benchmarks, an API for historical price feeds and their updates.

use {
    crate::{
        aggregate::{
            PriceFeedsWithUpdateData,
            UnixTimestamp,
        },
        api::types::PriceUpdate,
    },
    anyhow::Result,
    base64::{
        engine::general_purpose::STANDARD as base64_standard_engine,
        Engine as _,
    },
    pyth_sdk::PriceIdentifier,
    serde::Deserialize,
};

const BENCHMARKS_REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

#[derive(Deserialize, Debug, Clone)]
enum BlobEncoding {
    #[serde(rename = "base64")]
    Base64,
    #[serde(rename = "hex")]
    Hex,
}

#[derive(Deserialize, Debug, Clone)]
struct BinaryBlob {
    pub encoding: BlobEncoding,
    pub data:     Vec<String>,
}

impl TryFrom<BinaryBlob> for Vec<Vec<u8>> {
    type Error = anyhow::Error;

    fn try_from(binary_blob: BinaryBlob) -> Result<Self> {
        binary_blob
            .data
            .iter()
            .map(|datum| {
                Ok(match binary_blob.encoding {
                    BlobEncoding::Base64 => base64_standard_engine.decode(datum)?,
                    BlobEncoding::Hex => hex::decode(datum)?,
                })
            })
            .collect::<Result<_>>()
    }
}

#[async_trait::async_trait]
pub trait Benchmarks {
    async fn get_verified_price_feeds(
        &self,
        price_ids: &[PriceIdentifier],
        publish_time: UnixTimestamp,
    ) -> Result<PriceFeedsWithUpdateData>;
}

#[async_trait::async_trait]
impl Benchmarks for crate::state::State {
    async fn get_verified_price_feeds(
        &self,
        price_ids: &[PriceIdentifier],
        publish_time: UnixTimestamp,
    ) -> Result<PriceFeedsWithUpdateData> {
        let endpoint = self
            .benchmarks_endpoint
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Benchmarks endpoint is not set"))?
            .join(&format!("/v1/updates/price/{}", publish_time))
            .unwrap();

        let client = reqwest::Client::new();
        let mut request = client
            .get(endpoint)
            .timeout(BENCHMARKS_REQUEST_TIMEOUT)
            .query(&[("encoding", "hex")])
            .query(&[("parsed", "true")]);

        for price_id in price_ids {
            request = request.query(&[("ids", price_id)])
        }

        let response = request.send().await?;

        if response.status() != reqwest::StatusCode::OK {
            return Err(anyhow::anyhow!(format!(
                "Price update for price ids {:?} with publish time {} not found in benchmarks. Status code: {}, message: {}",
                price_ids, publish_time, response.status(), response.text().await?
            )));
        }

        let price_update: PriceUpdate = response.json().await?;
        price_update.try_into()
    }
}
