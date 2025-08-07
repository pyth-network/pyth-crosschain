//! WebSocket JSON protocol types for the API the router provides to consumers and publishers.

use {
    crate::{
        payload::AggregatedPriceFeedData,
        price::Price,
        rate::Rate,
        time::{DurationUs, TimestampUs},
    },
    anyhow::Context,
    derive_more::derive::{From, Into},
    itertools::Itertools,
    protobuf::well_known_types::duration::Duration as ProtobufDuration,
    serde::{de::Error, Deserialize, Serialize},
    std::{
        cmp::Ordering,
        fmt::Display,
        ops::{Deref, DerefMut},
    },
};

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, From, Into,
)]
pub struct PublisherId(pub u16);

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, From, Into,
)]
pub struct PriceFeedId(pub u32);

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, From, Into,
)]
pub struct ChannelId(pub u8);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PriceFeedProperty {
    Price,
    BestBidPrice,
    BestAskPrice,
    PublisherCount,
    Exponent,
    Confidence,
    FundingRate,
    FundingTimestamp,
    FundingRateInterval,
    // More fields may be added later.
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeliveryFormat {
    /// Deliver stream updates as JSON text messages.
    #[default]
    Json,
    /// Deliver stream updates as binary messages.
    Binary,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Format {
    Evm,
    Solana,
    LeEcdsa,
    LeUnsigned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JsonBinaryEncoding {
    #[default]
    Base64,
    Hex,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, From)]
pub enum Channel {
    FixedRate(FixedRate),
    RealTime,
}

impl PartialOrd for Channel {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        let rate_left = match self {
            Channel::FixedRate(rate) => rate.duration().as_micros(),
            Channel::RealTime => FixedRate::MIN.duration().as_micros(),
        };
        let rate_right = match other {
            Channel::FixedRate(rate) => rate.duration().as_micros(),
            Channel::RealTime => FixedRate::MIN.duration().as_micros(),
        };
        Some(rate_left.cmp(&rate_right))
    }
}

impl Serialize for Channel {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            Channel::FixedRate(fixed_rate) => serializer.serialize_str(&format!(
                "fixed_rate@{}ms",
                fixed_rate.duration().as_millis()
            )),
            Channel::RealTime => serializer.serialize_str("real_time"),
        }
    }
}

pub mod channel_ids {
    use super::ChannelId;

    pub const REAL_TIME: ChannelId = ChannelId(1);
    pub const FIXED_RATE_50: ChannelId = ChannelId(2);
    pub const FIXED_RATE_200: ChannelId = ChannelId(3);
}

impl Display for Channel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Channel::FixedRate(fixed_rate) => {
                write!(f, "fixed_rate@{}ms", fixed_rate.duration().as_millis())
            }
            Channel::RealTime => write!(f, "real_time"),
        }
    }
}

impl Channel {
    pub fn id(&self) -> ChannelId {
        match self {
            Channel::FixedRate(fixed_rate) => match fixed_rate.duration().as_millis() {
                50 => channel_ids::FIXED_RATE_50,
                200 => channel_ids::FIXED_RATE_200,
                _ => panic!("unknown channel: {self:?}"),
            },
            Channel::RealTime => channel_ids::REAL_TIME,
        }
    }
}

#[test]
fn id_supports_all_fixed_rates() {
    for rate in FixedRate::ALL {
        Channel::FixedRate(rate).id();
    }
}

fn parse_channel(value: &str) -> Option<Channel> {
    if value == "real_time" {
        Some(Channel::RealTime)
    } else if let Some(rest) = value.strip_prefix("fixed_rate@") {
        let ms_value = rest.strip_suffix("ms")?;
        Some(Channel::FixedRate(FixedRate::from_millis(
            ms_value.parse().ok()?,
        )?))
    } else {
        None
    }
}

impl<'de> Deserialize<'de> for Channel {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = <String>::deserialize(deserializer)?;
        parse_channel(&value).ok_or_else(|| Error::custom("unknown channel"))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct FixedRate {
    rate: DurationUs,
}

impl FixedRate {
    pub const RATE_50_MS: Self = Self {
        rate: DurationUs::from_millis_u32(50),
    };
    pub const RATE_200_MS: Self = Self {
        rate: DurationUs::from_millis_u32(200),
    };

    // Assumptions (tested below):
    // - Values are sorted.
    // - 1 second contains a whole number of each interval.
    // - all intervals are divisable by the smallest interval.
    pub const ALL: [Self; 2] = [Self::RATE_50_MS, Self::RATE_200_MS];
    pub const MIN: Self = Self::ALL[0];

    pub fn from_millis(millis: u32) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|v| v.rate.as_millis() == u64::from(millis))
    }

    pub fn duration(self) -> DurationUs {
        self.rate
    }
}

impl TryFrom<DurationUs> for FixedRate {
    type Error = anyhow::Error;

    fn try_from(value: DurationUs) -> Result<Self, Self::Error> {
        Self::ALL
            .into_iter()
            .find(|v| v.rate == value)
            .with_context(|| format!("unsupported rate: {value:?}"))
    }
}

impl TryFrom<&ProtobufDuration> for FixedRate {
    type Error = anyhow::Error;

    fn try_from(value: &ProtobufDuration) -> Result<Self, Self::Error> {
        let duration = DurationUs::try_from(value)?;
        Self::try_from(duration)
    }
}

impl TryFrom<ProtobufDuration> for FixedRate {
    type Error = anyhow::Error;

    fn try_from(duration: ProtobufDuration) -> anyhow::Result<Self> {
        TryFrom::<&ProtobufDuration>::try_from(&duration)
    }
}

impl From<FixedRate> for DurationUs {
    fn from(value: FixedRate) -> Self {
        value.rate
    }
}

impl From<FixedRate> for ProtobufDuration {
    fn from(value: FixedRate) -> Self {
        value.rate.into()
    }
}

#[test]
fn fixed_rate_values() {
    assert!(
        FixedRate::ALL.windows(2).all(|w| w[0] < w[1]),
        "values must be unique and sorted"
    );
    for value in FixedRate::ALL {
        assert_eq!(
            1_000_000 % value.duration().as_micros(),
            0,
            "1 s must contain whole number of intervals"
        );
        assert_eq!(
            value.duration().as_micros() % FixedRate::MIN.duration().as_micros(),
            0,
            "the interval's borders must be a subset of the minimal interval's borders"
        );
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionParamsRepr {
    pub price_feed_ids: Vec<PriceFeedId>,
    pub properties: Vec<PriceFeedProperty>,
    // "chains" was renamed to "formats". "chains" is still supported for compatibility.
    #[serde(alias = "chains")]
    pub formats: Vec<Format>,
    #[serde(default)]
    pub delivery_format: DeliveryFormat,
    #[serde(default)]
    pub json_binary_encoding: JsonBinaryEncoding,
    /// If `true`, the stream update will contain a `parsed` JSON field containing
    /// all data of the update.
    #[serde(default = "default_parsed")]
    pub parsed: bool,
    pub channel: Channel,
    #[serde(default)]
    pub ignore_invalid_feed_ids: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionParams(SubscriptionParamsRepr);

impl<'de> Deserialize<'de> for SubscriptionParams {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = SubscriptionParamsRepr::deserialize(deserializer)?;
        Self::new(value).map_err(Error::custom)
    }
}

impl SubscriptionParams {
    pub fn new(value: SubscriptionParamsRepr) -> Result<Self, &'static str> {
        if value.price_feed_ids.is_empty() {
            return Err("no price feed ids specified");
        }
        if !value.price_feed_ids.iter().all_unique() {
            return Err("duplicate price feed ids specified");
        }
        if !value.formats.iter().all_unique() {
            return Err("duplicate formats or chains specified");
        }
        if value.properties.is_empty() {
            return Err("no properties specified");
        }
        if !value.properties.iter().all_unique() {
            return Err("duplicate properties specified");
        }
        Ok(Self(value))
    }
}

impl Deref for SubscriptionParams {
    type Target = SubscriptionParamsRepr;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl DerefMut for SubscriptionParams {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

pub fn default_parsed() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonBinaryData {
    pub encoding: JsonBinaryEncoding,
    pub data: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonUpdate {
    /// Present unless `parsed = false` is specified in subscription params.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parsed: Option<ParsedPayload>,
    /// Only present if `Evm` is present in `formats` in subscription params.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evm: Option<JsonBinaryData>,
    /// Only present if `Solana` is present in `formats` in subscription params.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub solana: Option<JsonBinaryData>,
    /// Only present if `LeEcdsa` is present in `formats` in subscription params.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub le_ecdsa: Option<JsonBinaryData>,
    /// Only present if `LeUnsigned` is present in `formats` in subscription params.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub le_unsigned: Option<JsonBinaryData>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedPayload {
    #[serde(with = "crate::serde_str::timestamp")]
    pub timestamp_us: TimestampUs,
    pub price_feeds: Vec<ParsedFeedPayload>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedFeedPayload {
    pub price_feed_id: PriceFeedId,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "crate::serde_str::option_price")]
    #[serde(default)]
    pub price: Option<Price>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "crate::serde_str::option_price")]
    #[serde(default)]
    pub best_bid_price: Option<Price>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "crate::serde_str::option_price")]
    #[serde(default)]
    pub best_ask_price: Option<Price>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub publisher_count: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub exponent: Option<i16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub confidence: Option<Price>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub funding_rate: Option<Rate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub funding_timestamp: Option<TimestampUs>,
    // More fields may be added later.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub funding_rate_interval: Option<DurationUs>,
}

impl ParsedFeedPayload {
    pub fn new(
        price_feed_id: PriceFeedId,
        exponent: Option<i16>,
        data: &AggregatedPriceFeedData,
        properties: &[PriceFeedProperty],
    ) -> Self {
        let mut output = Self {
            price_feed_id,
            price: None,
            best_bid_price: None,
            best_ask_price: None,
            publisher_count: None,
            exponent: None,
            confidence: None,
            funding_rate: None,
            funding_timestamp: None,
            funding_rate_interval: None,
        };
        for &property in properties {
            match property {
                PriceFeedProperty::Price => {
                    output.price = data.price;
                }
                PriceFeedProperty::BestBidPrice => {
                    output.best_bid_price = data.best_bid_price;
                }
                PriceFeedProperty::BestAskPrice => {
                    output.best_ask_price = data.best_ask_price;
                }
                PriceFeedProperty::PublisherCount => {
                    output.publisher_count = Some(data.publisher_count);
                }
                PriceFeedProperty::Exponent => {
                    output.exponent = exponent;
                }
                PriceFeedProperty::Confidence => {
                    output.confidence = data.confidence;
                }
                PriceFeedProperty::FundingRate => {
                    output.funding_rate = data.funding_rate;
                }
                PriceFeedProperty::FundingTimestamp => {
                    output.funding_timestamp = data.funding_timestamp;
                }
                PriceFeedProperty::FundingRateInterval => {
                    output.funding_rate_interval = data.funding_rate_interval;
                }
            }
        }
        output
    }

    pub fn new_full(
        price_feed_id: PriceFeedId,
        exponent: Option<i16>,
        data: &AggregatedPriceFeedData,
    ) -> Self {
        Self {
            price_feed_id,
            price: data.price,
            best_bid_price: data.best_bid_price,
            best_ask_price: data.best_ask_price,
            publisher_count: Some(data.publisher_count),
            exponent,
            confidence: data.confidence,
            funding_rate: data.funding_rate,
            funding_timestamp: data.funding_timestamp,
            funding_rate_interval: data.funding_rate_interval,
        }
    }
}
