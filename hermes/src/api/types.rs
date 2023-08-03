use {
    crate::{
        impl_deserialize_for_hex_string_wrapper,
        store::types::{
            PriceFeedUpdate,
            Slot,
            UnixTimestamp,
        },
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
    hex::FromHexError,
    pyth_sdk::PriceIdentifier,
    utoipa::ToSchema,
    wormhole_sdk::Chain,
};


/// A price id is a 32-byte hex string, optionally prefixed with "0x".
/// Price ids are case insensitive.
///
/// Examples:
/// * 0x63f341689d98a12ef60a5cff1d7f85c70a9e17bf1575f0e7c0b2512d48b1c8b3
/// * 63f341689d98a12ef60a5cff1d7f85c70a9e17bf1575f0e7c0b2512d48b1c8b3
///
/// See https://pyth.network/developers/price-feed-ids for a list of all price feed ids.
#[derive(Debug, Clone, Deref, DerefMut, ToSchema)]
#[schema(value_type=String, example="63f341689d98a12ef60a5cff1d7f85c70a9e17bf1575f0e7c0b2512d48b1c8b3")]
pub struct PriceIdInput([u8; 32]);
// TODO: Use const generics instead of macro.
impl_deserialize_for_hex_string_wrapper!(PriceIdInput, 32);

impl From<PriceIdInput> for PriceIdentifier {
    fn from(id: PriceIdInput) -> Self {
        Self::new(*id)
    }
}

type Base64String = String;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct RpcPriceFeedMetadata {
    #[schema(value_type = u64, example=85480034)]
    pub slot:                       Slot,
    #[schema(example = 26)]
    pub emitter_chain:              u16,
    #[schema(value_type = i64, example=1690576641)]
    pub price_service_receive_time: UnixTimestamp,
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
    #[schema(value_type = Option<String>, example="UE5BVQEAAAADuAEAAAADDQC1H7meY5fTed0FsykIb8dt+7nKpbuzfvU2DplDi+dcUl8MC+UIkS65+rkiq+zmNBxE2gaxkBkjdIicZ/fBo+X7AAEqp+WtlWb84np8jJfLpuQ2W+l5KXTigsdAhz5DyVgU3xs+EnaIZxBwcE7EKzjMam+V9rlRy0CGsiQ1kjqqLzfAAQLsoVO0Vu5gVmgc8XGQ7xYhoz36rsBgMjG+e3l/B01esQi/KzPuBf/Ar8Sg5aSEOvEU0muSDb+KIr6d8eEC+FtcAAPZEaBSt4ysXVL84LUcJemQD3SiG30kOfUpF8o7/wI2M2Jf/LyCsbKEQUyLtLbZqnJBSfZJR5AMsrnHDqngMLEGAAY4UDG9GCpRuPvg8hOlsrXuPP3zq7yVPqyG0SG+bNo8rEhP5b1vXlHdG4bZsutX47d5VZ6xnFROKudx3T3/fnWUAQgAU1+kUFc3e0ZZeX1dLRVEryNIVyxMQIcxWwdey+jlIAYowHRM0fJX3Scs80OnT/CERwh5LMlFyU1w578NqxW+AQl2E/9fxjgUTi8crOfDpwsUsmOWw0+Q5OUGhELv/2UZoHAjsaw9OinWUggKACo4SdpPlHYldoWF+J2yGWOW+F4iAQre4c+ocb6a9uSWOnTldFkioqhd9lhmV542+VonCvuy4Tu214NP+2UNd/4Kk3KJCf3iziQJrCBeLi1cLHdLUikgAQtvRFR/nepcF9legl+DywAkUHi5/1MNjlEQvlHyh2XbMiS85yu7/9LgM6Sr+0ukfZY5mSkOcvUkpHn+T+Nw/IrQAQ7lty5luvKUmBpI3ITxSmojJ1aJ0kj/dc0ZcQk+/qo0l0l3/eRLkYjw5j+MZKA8jEubrHzUCke98eSoj8l08+PGAA+DAKNtCwNZe4p6J1Ucod8Lo5RKFfA84CPLVyEzEPQFZ25U9grUK6ilF4GhEia/ndYXLBt3PGW3qa6CBBPM7rH3ABGAyYEtUwzB4CeVedA5o6cKpjRkIebqDNSOqltsr+w7kXdfFVtsK2FMGFZNt5rbpIR+ppztoJ6eOKHmKmi9nQ99ARKkTxRErOs9wJXNHaAuIRV38o1pxRrlQRzGsRuKBqxcQEpC8OPFpyKYcp6iD5l7cO/gRDTamLFyhiUBwKKMP07FAWTEJv8AAAAAABrhAfrtrFhR4yubI7X5QRqMK6xKrj7U3XuBHdGnLqSqcQAAAAAAGp0GAUFVV1YAAAAAAAUYUmIAACcQBsfKUtr4PgZbIXRxRESU79PjE4IBAFUA5i32yLSoX+GmfbRNwS3l2zMPesZrctxliv7fD0pBW0MAAAKqqMJFwAAAAAAqE/NX////+AAAAABkxCb7AAAAAGTEJvoAAAKqIcWxYAAAAAAlR5m4CP/mPsh1IezjYpDlJ4GRb5q4fTs2LjtyO6M0XgVimrIQ4kSh1qg7JKW4gbGkyRntVFR9JO/GNd3FPDit0BK6M+JzXh/h12YNCz9wxlZTvXrNtWNbzqT+91pvl5cphhSPMfAHyEzTPaGR9tKDy9KNu56pmhaY32d2vfEWQmKo22guegeR98oDxs67MmnUraco46a3zEnac2Bm80pasUgMO24=")]
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
        let price_feed_message = price_feed_update.price_feed;

        Self {
            id:        RpcPriceIdentifier::new(price_feed_message.feed_id),
            price:     RpcPrice {
                price:        price_feed_message.price,
                conf:         price_feed_message.conf,
                expo:         price_feed_message.exponent,
                publish_time: price_feed_message.publish_time,
            },
            ema_price: RpcPrice {
                price:        price_feed_message.ema_price,
                conf:         price_feed_message.ema_conf,
                expo:         price_feed_message.exponent,
                publish_time: price_feed_message.publish_time,
            },
            metadata:  verbose.then_some(RpcPriceFeedMetadata {
                emitter_chain:              Chain::Pythnet.into(),
                price_service_receive_time: price_feed_update.received_at,
                slot:                       price_feed_update.slot,
            }),
            vaa:       binary.then_some(
                base64_standard_engine.encode(price_feed_update.wormhole_merkle_update_data),
            ),
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
    #[schema(value_type = i64, example=1690576641)]
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
#[schema(value_type = String, example = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43")]
pub struct RpcPriceIdentifier(#[serde(with = "hex")] [u8; 32]);

impl RpcPriceIdentifier {
    pub fn new(bytes: [u8; 32]) -> RpcPriceIdentifier {
        RpcPriceIdentifier(bytes)
    }

    pub fn from(id: &PriceIdentifier) -> RpcPriceIdentifier {
        RpcPriceIdentifier(id.to_bytes().clone())
    }
}
