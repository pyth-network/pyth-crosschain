//! This module communicates with Pyth Benchmarks, an API for historical price feeds and their updates.

use {
    crate::{
        aggregate::{
            PriceFeedUpdate,
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
    pyth_sdk::{
        Price,
        PriceFeed,
        PriceIdentifier,
    },
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


impl TryFrom<PriceUpdate> for PriceFeedsWithUpdateData {
    type Error = anyhow::Error;
    fn try_from(price_update: PriceUpdate) -> Result<Self> {
        let price_feeds = match price_update.parsed {
            Some(parsed_updates) => parsed_updates
                .into_iter()
                .map(|parsed_price_update| {
                    Ok(PriceFeedUpdate {
                        price_feed:        PriceFeed::new(
                            parsed_price_update.id,
                            Price {
                                price:        parsed_price_update.price.price,
                                conf:         parsed_price_update.price.conf,
                                expo:         parsed_price_update.price.expo,
                                publish_time: parsed_price_update.price.publish_time,
                            },
                            Price {
                                price:        parsed_price_update.ema_price.price,
                                conf:         parsed_price_update.ema_price.conf,
                                expo:         parsed_price_update.ema_price.expo,
                                publish_time: parsed_price_update.ema_price.publish_time,
                            },
                        ),
                        slot:              parsed_price_update.metadata.slot,
                        received_at:       parsed_price_update.metadata.proof_available_time,
                        update_data:       None, // This field is not available in ParsedPriceUpdate
                        prev_publish_time: parsed_price_update.metadata.prev_publish_time,
                    })
                })
                .collect::<Result<Vec<_>>>(),
            None => Err(anyhow::anyhow!("No parsed price updates available")),
        }?;

        let update_data = price_update
            .binary
            .data
            .iter()
            .map(|hex_str| hex::decode(hex_str).unwrap_or_default())
            .collect::<Vec<Vec<u8>>>();

        Ok(PriceFeedsWithUpdateData {
            price_feeds,
            update_data,
        })
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
