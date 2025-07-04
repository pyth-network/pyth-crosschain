use {
    super::doc_examples,
    crate::state::aggregate::{
        PriceFeedTwap, PriceFeedUpdate, PriceFeedsWithUpdateData, Slot, UnixTimestamp,
    },
    anyhow::Result,
    base64::{engine::general_purpose::STANDARD as base64_standard_engine, Engine as _},
    borsh::{BorshDeserialize, BorshSerialize},
    derive_more::{Deref, DerefMut},
    pyth_sdk::{Price, PriceFeed, PriceIdentifier},
    rust_decimal::Decimal,
    serde::{Deserialize, Serialize},
    std::{
        collections::BTreeMap,
        fmt::{Display, Formatter, Result as FmtResult},
    },
    utoipa::ToSchema,
    wormhole_sdk::Chain,
};

/// A price id is a 32-byte hex string, optionally prefixed with "0x".
/// Price ids are case insensitive.
///
/// Examples:
/// * 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
/// * e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
///
/// See https://pyth.network/developers/price-feed-ids for a list of all price feed ids.
#[derive(Clone, Debug, Deref, DerefMut, Deserialize, Serialize, ToSchema)]
#[schema(value_type=String, example=doc_examples::price_feed_id_example)]
pub struct PriceIdInput(#[serde(with = "crate::serde::hex")] [u8; 32]);

impl From<PriceIdInput> for PriceIdentifier {
    fn from(id: PriceIdInput) -> Self {
        Self::new(*id)
    }
}

type Base64String = String;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RpcPriceFeedMetadata {
    #[schema(value_type = Option<u64>, example=85480034)]
    pub slot: Option<Slot>,
    #[schema(example = 26)]
    pub emitter_chain: u16,
    #[schema(value_type = Option<i64>, example=doc_examples::timestamp_example)]
    pub price_service_receive_time: Option<UnixTimestamp>,
    #[schema(value_type = Option<i64>, example=doc_examples::timestamp_example)]
    pub prev_publish_time: Option<UnixTimestamp>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RpcPriceFeedMetadataV2 {
    #[schema(value_type = Option<u64>, example=85480034)]
    pub slot: Option<Slot>,
    #[schema(value_type = Option<i64>, example=doc_examples::timestamp_example)]
    pub proof_available_time: Option<UnixTimestamp>,
    #[schema(value_type = Option<i64>, example=doc_examples::timestamp_example)]
    pub prev_publish_time: Option<UnixTimestamp>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RpcPriceFeed {
    pub id: RpcPriceIdentifier,
    pub price: RpcPrice,
    pub ema_price: RpcPrice,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<RpcPriceFeedMetadata>,
    /// The VAA binary represented as a base64 string.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>, example=doc_examples::vaa_example)]
    pub vaa: Option<Base64String>,
}

impl RpcPriceFeed {
    // TODO: Use a Encoding type to have None, Base64, and Hex variants instead of binary flag.
    // TODO: Use a Verbosity type to define None, or Full instead of verbose flag.
    pub fn from_price_feed_update(
        price_feed_update: PriceFeedUpdate,
        verbose: bool,
        binary: bool,
    ) -> Self {
        let price_feed = price_feed_update.price_feed;

        Self {
            id: RpcPriceIdentifier::new(price_feed.id.to_bytes()),
            price: RpcPrice {
                price: price_feed.get_price_unchecked().price,
                conf: price_feed.get_price_unchecked().conf,
                expo: price_feed.get_price_unchecked().expo,
                publish_time: price_feed.get_price_unchecked().publish_time,
            },
            ema_price: RpcPrice {
                price: price_feed.get_ema_price_unchecked().price,
                conf: price_feed.get_ema_price_unchecked().conf,
                expo: price_feed.get_ema_price_unchecked().expo,
                publish_time: price_feed.get_ema_price_unchecked().publish_time,
            },
            metadata: verbose.then_some(RpcPriceFeedMetadata {
                emitter_chain: Chain::Pythnet.into(),
                price_service_receive_time: price_feed_update.received_at,
                slot: price_feed_update.slot,
                prev_publish_time: price_feed_update.prev_publish_time,
            }),
            vaa: match binary {
                false => None,
                true => price_feed_update
                    .update_data
                    .map(|data| base64_standard_engine.encode(data)),
            },
        }
    }
}

/// A price with a degree of uncertainty at a certain time, represented as a price +- a confidence
/// interval.
///
/// The confidence interval roughly corresponds to the standard error of a normal distribution.
/// Both the price and confidence are stored in a fixed-point numeric representation, `x *
/// 10^expo`, where `expo` is the exponent. For example:
#[derive(
    Clone,
    Copy,
    Default,
    Debug,
    PartialEq,
    Eq,
    BorshSerialize,
    BorshDeserialize,
    Serialize,
    Deserialize,
    ToSchema,
)]
pub struct RpcPrice {
    /// The price itself, stored as a string to avoid precision loss
    #[serde(with = "pyth_sdk::utils::as_string")]
    #[schema(value_type = String, example="2920679499999")]
    pub price: i64,
    /// The confidence interval associated with the price, stored as a string to avoid precision loss
    #[serde(with = "pyth_sdk::utils::as_string")]
    #[schema(value_type = String, example="509500001")]
    pub conf: u64,
    /// The exponent associated with both the price and confidence interval. Multiply those values
    /// by `10^expo` to get the real value.
    #[schema(example = -8)]
    pub expo: i32,
    /// When the price was published. The `publish_time` is a unix timestamp, i.e., the number of
    /// seconds since the Unix epoch (00:00:00 UTC on 1 Jan 1970).
    #[schema(value_type = i64, example=doc_examples::timestamp_example)]
    pub publish_time: UnixTimestamp,
}

#[derive(
    Copy,
    Clone,
    Debug,
    Default,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
    BorshSerialize,
    BorshDeserialize,
    Serialize,
    Deserialize,
    ToSchema,
)]
#[repr(C)]
#[schema(value_type = String, example = doc_examples::price_feed_id_example)]
pub struct RpcPriceIdentifier(#[serde(with = "hex")] [u8; 32]);

impl RpcPriceIdentifier {
    pub fn new(bytes: [u8; 32]) -> RpcPriceIdentifier {
        RpcPriceIdentifier(bytes)
    }
}

impl From<RpcPriceIdentifier> for PriceIdentifier {
    fn from(id: RpcPriceIdentifier) -> Self {
        PriceIdentifier::new(id.0)
    }
}

impl From<PriceIdentifier> for RpcPriceIdentifier {
    fn from(id: PriceIdentifier) -> Self {
        RpcPriceIdentifier(id.to_bytes())
    }
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, ToSchema)]
pub enum EncodingType {
    #[default]
    #[serde(rename = "hex")]
    Hex,
    #[serde(rename = "base64")]
    Base64,
}

impl EncodingType {
    pub fn encode_str(&self, data: &[u8]) -> String {
        match self {
            EncodingType::Base64 => base64_standard_engine.encode(data),
            EncodingType::Hex => hex::encode(data),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BinaryUpdate {
    pub encoding: EncodingType,
    pub data: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ParsedPriceUpdate {
    pub id: RpcPriceIdentifier,
    pub price: RpcPrice,
    pub ema_price: RpcPrice,
    pub metadata: RpcPriceFeedMetadataV2,
}

impl From<PriceFeedUpdate> for ParsedPriceUpdate {
    fn from(price_feed_update: PriceFeedUpdate) -> Self {
        let price_feed = price_feed_update.price_feed;

        Self {
            id: RpcPriceIdentifier::from(price_feed.id),
            price: RpcPrice {
                price: price_feed.get_price_unchecked().price,
                conf: price_feed.get_price_unchecked().conf,
                expo: price_feed.get_price_unchecked().expo,
                publish_time: price_feed.get_price_unchecked().publish_time,
            },
            ema_price: RpcPrice {
                price: price_feed.get_ema_price_unchecked().price,
                conf: price_feed.get_ema_price_unchecked().conf,
                expo: price_feed.get_ema_price_unchecked().expo,
                publish_time: price_feed.get_ema_price_unchecked().publish_time,
            },
            metadata: RpcPriceFeedMetadataV2 {
                proof_available_time: price_feed_update.received_at,
                slot: price_feed_update.slot,
                prev_publish_time: price_feed_update.prev_publish_time,
            },
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ParsedPriceFeedTwap {
    pub id: RpcPriceIdentifier,
    /// The start unix timestamp of the window
    pub start_timestamp: i64,
    /// The end unix timestamp of the window
    pub end_timestamp: i64,
    /// The calculated time weighted average price over the window
    pub twap: RpcPrice,
    /// The % of slots where the network was down over the TWAP window.
    /// A value of zero indicates no slots were missed over the window, and
    /// a value of one indicates that every slot was missed over the window.
    /// This is a float value stored as a string to avoid precision loss.
    pub down_slots_ratio: Decimal,
}
impl From<PriceFeedTwap> for ParsedPriceFeedTwap {
    fn from(pft: PriceFeedTwap) -> Self {
        Self {
            id: RpcPriceIdentifier::from(pft.id),
            start_timestamp: pft.start_timestamp,
            end_timestamp: pft.end_timestamp,
            twap: RpcPrice {
                price: pft.twap.price,
                conf: pft.twap.conf,
                expo: pft.twap.expo,
                publish_time: pft.twap.publish_time,
            },
            down_slots_ratio: pft.down_slots_ratio,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TwapsResponse {
    /// Contains the start & end cumulative price updates used to
    /// calculate a given price feed's TWAP.
    pub binary: BinaryUpdate,

    /// The calculated TWAPs for each price ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parsed: Option<Vec<ParsedPriceFeedTwap>>,
}

#[derive(Debug, PartialEq, serde::Serialize, serde::Deserialize, Clone, ToSchema)]
pub struct ParsedPublisherStakeCapsUpdate {
    pub publisher_stake_caps: Vec<ParsedPublisherStakeCap>,
}

#[derive(Debug, PartialEq, serde::Serialize, serde::Deserialize, Clone, ToSchema)]
pub struct ParsedPublisherStakeCap {
    pub publisher: String,
    pub cap: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LatestPublisherStakeCapsUpdateDataResponse {
    pub binary: BinaryUpdate,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parsed: Option<Vec<ParsedPublisherStakeCapsUpdate>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PriceUpdate {
    pub binary: BinaryUpdate,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parsed: Option<Vec<ParsedPriceUpdate>>,
}

impl TryFrom<PriceUpdate> for PriceFeedsWithUpdateData {
    type Error = anyhow::Error;
    fn try_from(price_update: PriceUpdate) -> Result<Self> {
        let price_feeds = match price_update.parsed {
            Some(parsed_updates) => parsed_updates
                .into_iter()
                .map(|parsed_price_update| {
                    Ok(PriceFeedUpdate {
                        price_feed: PriceFeed::new(
                            parsed_price_update.id.into(),
                            Price {
                                price: parsed_price_update.price.price,
                                conf: parsed_price_update.price.conf,
                                expo: parsed_price_update.price.expo,
                                publish_time: parsed_price_update.price.publish_time,
                            },
                            Price {
                                price: parsed_price_update.ema_price.price,
                                conf: parsed_price_update.ema_price.conf,
                                expo: parsed_price_update.ema_price.expo,
                                publish_time: parsed_price_update.ema_price.publish_time,
                            },
                        ),
                        slot: parsed_price_update.metadata.slot,
                        received_at: parsed_price_update.metadata.proof_available_time,
                        update_data: None, // This field is not available in ParsedPriceUpdate
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

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PriceFeedMetadata {
    pub id: RpcPriceIdentifier,
    // BTreeMap is used to automatically sort the keys to ensure consistent ordering of attributes in the JSON response.
    // This enhances user experience by providing a predictable structure, avoiding confusion from varying orders in different responses.
    pub attributes: BTreeMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AssetType {
    Crypto,
    #[serde(rename = "fx")]
    FX,
    Equity,
    Metal,
    Rates,
    CryptoRedemptionRate,
}

impl Display for AssetType {
    fn fmt(&self, f: &mut Formatter) -> FmtResult {
        match self {
            AssetType::Crypto => write!(f, "crypto"),
            AssetType::FX => write!(f, "fx"),
            AssetType::Equity => write!(f, "equity"),
            AssetType::Metal => write!(f, "metal"),
            AssetType::Rates => write!(f, "rates"),
            AssetType::CryptoRedemptionRate => write!(f, "crypto_redemption_rate"),
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, reason = "tests")]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_matches_display() {
        assert_eq!(
            AssetType::Crypto.to_string(),
            serde_json::to_string(&AssetType::Crypto)
                .unwrap()
                .trim_matches('"')
        );
        assert_eq!(
            AssetType::FX.to_string(),
            serde_json::to_string(&AssetType::FX)
                .unwrap()
                .trim_matches('"')
        );
        assert_eq!(
            AssetType::Equity.to_string(),
            serde_json::to_string(&AssetType::Equity)
                .unwrap()
                .trim_matches('"')
        );
        assert_eq!(
            AssetType::Metal.to_string(),
            serde_json::to_string(&AssetType::Metal)
                .unwrap()
                .trim_matches('"')
        );
        assert_eq!(
            AssetType::Rates.to_string(),
            serde_json::to_string(&AssetType::Rates)
                .unwrap()
                .trim_matches('"')
        );
        assert_eq!(
            AssetType::CryptoRedemptionRate.to_string(),
            serde_json::to_string(&AssetType::CryptoRedemptionRate)
                .unwrap()
                .trim_matches('"')
        );
    }
}
