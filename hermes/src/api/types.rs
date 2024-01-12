use {
    super::doc_examples,
    crate::aggregate::{
        PriceFeedUpdate,
        Slot,
        UnixTimestamp,
    },
    base64::{
        engine::general_purpose::STANDARD as base64_standard_engine,
        Engine as _,
    },
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    derive_more::{
        Deref,
        DerefMut,
    },
    pyth_sdk::PriceIdentifier,
    serde::{
        Deserialize,
        Serialize,
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct RpcPriceFeedMetadata {
    #[schema(value_type = Option<u64>, example=85480034)]
    pub slot:                       Option<Slot>,
    #[schema(example = 26)]
    pub emitter_chain:              u16,
    #[schema(value_type = Option<i64>, example=doc_examples::timestamp_example)]
    pub price_service_receive_time: Option<UnixTimestamp>,
    #[schema(value_type = Option<i64>, example=doc_examples::timestamp_example)]
    pub prev_publish_time:          Option<UnixTimestamp>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct RpcPriceFeedMetadataV2 {
    #[schema(value_type = Option<u64>, example=85480034)]
    pub slot:                 Option<Slot>,
    #[schema(value_type = Option<i64>, example=doc_examples::timestamp_example)]
    pub proof_available_time: Option<UnixTimestamp>,
    #[schema(value_type = Option<i64>, example=doc_examples::timestamp_example)]
    pub prev_publish_time:    Option<UnixTimestamp>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct RpcPriceFeed {
    pub id:        RpcPriceIdentifier,
    pub price:     RpcPrice,
    pub ema_price: RpcPrice,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata:  Option<RpcPriceFeedMetadata>,
    /// The VAA binary represented as a base64 string.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>, example=doc_examples::vaa_example)]
    pub vaa:       Option<Base64String>,
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
            id:        RpcPriceIdentifier::new(price_feed.id.to_bytes()),
            price:     RpcPrice {
                price:        price_feed.get_price_unchecked().price,
                conf:         price_feed.get_price_unchecked().conf,
                expo:         price_feed.get_price_unchecked().expo,
                publish_time: price_feed.get_price_unchecked().publish_time,
            },
            ema_price: RpcPrice {
                price:        price_feed.get_ema_price_unchecked().price,
                conf:         price_feed.get_ema_price_unchecked().conf,
                expo:         price_feed.get_ema_price_unchecked().expo,
                publish_time: price_feed.get_ema_price_unchecked().publish_time,
            },
            metadata:  verbose.then_some(RpcPriceFeedMetadata {
                emitter_chain:              Chain::Pythnet.into(),
                price_service_receive_time: price_feed_update.received_at,
                slot:                       price_feed_update.slot,
                prev_publish_time:          price_feed_update.prev_publish_time,
            }),
            vaa:       match binary {
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
    serde::Serialize,
    serde::Deserialize,
    ToSchema,
)]
pub struct RpcPrice {
    /// The price itself, stored as a string to avoid precision loss
    #[serde(with = "pyth_sdk::utils::as_string")]
    #[schema(value_type = String, example="2920679499999")]
    pub price:        i64,
    /// The confidence interval associated with the price, stored as a string to avoid precision loss
    #[serde(with = "pyth_sdk::utils::as_string")]
    #[schema(value_type = String, example="509500001")]
    pub conf:         u64,
    /// The exponent associated with both the price and confidence interval. Multiply those values
    /// by `10^expo` to get the real value.
    #[schema(example=-8)]
    pub expo:         i32,
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
    serde::Serialize,
    serde::Deserialize,
    ToSchema,
)]
#[repr(C)]
#[schema(value_type = String, example = doc_examples::price_feed_id_example)]
pub struct RpcPriceIdentifier(#[serde(with = "hex")] [u8; 32]);

impl RpcPriceIdentifier {
    pub fn new(bytes: [u8; 32]) -> RpcPriceIdentifier {
        RpcPriceIdentifier(bytes)
    }

    pub fn from(id: &PriceIdentifier) -> RpcPriceIdentifier {
        RpcPriceIdentifier(id.to_bytes())
    }
}

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize)]
pub enum EncodingType {
    #[serde(rename = "base64")]
    Base64,
    #[serde(rename = "hex")]
    Hex,
}

impl Default for EncodingType {
    fn default() -> Self {
        EncodingType::Hex
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct BinaryPriceUpdate {
    pub encoding: EncodingType,
    pub data:     Vec<Base64String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct ParsedPriceUpdate {
    pub id:        String,
    pub price:     RpcPrice,
    pub ema_price: RpcPrice,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct PriceUpdate {
    pub binary:   BinaryPriceUpdate,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parsed:   Option<Vec<ParsedPriceUpdate>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<RpcPriceFeedMetadataV2>,
}

impl PriceUpdate {
    pub fn from_price_feed_update(
        price_feed_update: PriceFeedUpdate,
        verbose: bool,
        parsed: bool,
        encoding: EncodingType,
    ) -> Self {
        let price_feed = price_feed_update.price_feed;

        Self {
            binary:   BinaryPriceUpdate {
                encoding,
                data: match price_feed_update.update_data {
                    Some(data) => match encoding {
                        EncodingType::Base64 => vec![base64_standard_engine.encode(data)],
                        EncodingType::Hex => vec![hex::encode(data)],
                    },
                    None => vec![],
                },
            },
            parsed:   parsed.then_some(vec![ParsedPriceUpdate {
                id:        price_feed.id.to_string(),
                price:     RpcPrice {
                    price:        price_feed.get_price_unchecked().price,
                    conf:         price_feed.get_price_unchecked().conf,
                    expo:         price_feed.get_price_unchecked().expo,
                    publish_time: price_feed.get_price_unchecked().publish_time,
                },
                ema_price: RpcPrice {
                    price:        price_feed.get_ema_price_unchecked().price,
                    conf:         price_feed.get_ema_price_unchecked().conf,
                    expo:         price_feed.get_ema_price_unchecked().expo,
                    publish_time: price_feed.get_ema_price_unchecked().publish_time,
                },
            }]),
            metadata: verbose.then_some(RpcPriceFeedMetadataV2 {
                proof_available_time: price_feed_update.received_at,
                slot:                 price_feed_update.slot,
                prev_publish_time:    price_feed_update.prev_publish_time,
            }),
        }
    }
}
