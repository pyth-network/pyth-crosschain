use std::{
    fmt::Display,
    ops::{Deref, DerefMut},
};

use derive_more::derive::From;
use itertools::Itertools as _;
use serde::{de::Error, Deserialize, Serialize};

use crate::{
    payload::AggregatedPriceFeedData,
    time::{DurationUs, FixedRate, TimestampUs},
    ChannelId, Price, PriceFeedId, PriceFeedProperty, Rate,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestPriceRequest {
    pub price_feed_ids: Vec<PriceFeedId>,
    pub properties: Vec<PriceFeedProperty>,
    // "chains" was renamed to "formats". "chains" is still supported for compatibility.
    #[serde(alias = "chains")]
    pub formats: Vec<Format>,
    #[serde(default)]
    pub json_binary_encoding: JsonBinaryEncoding,
    /// If `true`, the stream update will contain a JSON object containing
    /// all data of the update.
    #[serde(default = "default_parsed")]
    pub parsed: bool,
    pub channel: Channel,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceRequest {
    pub timestamp: TimestampUs,
    pub price_feed_ids: Vec<PriceFeedId>,
    pub properties: Vec<PriceFeedProperty>,
    pub formats: Vec<Format>,
    #[serde(default)]
    pub json_binary_encoding: JsonBinaryEncoding,
    /// If `true`, the stream update will contain a JSON object containing
    /// all data of the update.
    #[serde(default = "default_parsed")]
    pub parsed: bool,
    pub channel: Channel,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReducePriceRequest {
    pub payload: JsonUpdate,
    pub price_feed_ids: Vec<PriceFeedId>,
}

pub type LatestPriceResponse = JsonUpdate;
pub type ReducePriceResponse = JsonUpdate;
pub type PriceResponse = JsonUpdate;

pub fn default_parsed() -> bool {
    true
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, From)]
pub enum Channel {
    FixedRate(FixedRate),
}

impl Serialize for Channel {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            Channel::FixedRate(fixed_rate) => {
                if *fixed_rate == FixedRate::MIN {
                    return serializer.serialize_str("real_time");
                }
                serializer.serialize_str(&format!(
                    "fixed_rate@{}ms",
                    fixed_rate.duration().as_millis()
                ))
            }
        }
    }
}

impl Display for Channel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Channel::FixedRate(fixed_rate) => match *fixed_rate {
                FixedRate::MIN => write!(f, "real_time"),
                rate => write!(f, "fixed_rate@{}ms", rate.duration().as_millis()),
            },
        }
    }
}

impl Channel {
    pub fn id(&self) -> ChannelId {
        match self {
            Channel::FixedRate(fixed_rate) => match fixed_rate.duration().as_millis() {
                1 => ChannelId::FIXED_RATE_1,
                50 => ChannelId::FIXED_RATE_50,
                200 => ChannelId::FIXED_RATE_200,
                _ => panic!("unknown channel: {self:?}"),
            },
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
        Some(Channel::FixedRate(FixedRate::MIN))
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

/// A request sent from the client to the server.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "camelCase")]
pub enum WsRequest {
    Subscribe(SubscribeRequest),
    Unsubscribe(UnsubscribeRequest),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct SubscriptionId(pub u64);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeRequest {
    pub subscription_id: SubscriptionId,
    #[serde(flatten)]
    pub params: SubscriptionParams,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsubscribeRequest {
    pub subscription_id: SubscriptionId,
}

/// A JSON response sent from the server to the client.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, From)]
#[serde(tag = "type")]
#[serde(rename_all = "camelCase")]
pub enum WsResponse {
    Error(ErrorResponse),
    Subscribed(SubscribedResponse),
    SubscribedWithInvalidFeedIdsIgnored(SubscribedWithInvalidFeedIdsIgnoredResponse),
    Unsubscribed(UnsubscribedResponse),
    SubscriptionError(SubscriptionErrorResponse),
    StreamUpdated(StreamUpdatedResponse),
}

/// Sent from the server after a successul subscription.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribedResponse {
    pub subscription_id: SubscriptionId,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvalidFeedSubscriptionDetails {
    pub unknown_ids: Vec<PriceFeedId>,
    pub unsupported_channels: Vec<PriceFeedId>,
    pub unstable: Vec<PriceFeedId>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribedWithInvalidFeedIdsIgnoredResponse {
    pub subscription_id: SubscriptionId,
    pub subscribed_feed_ids: Vec<PriceFeedId>,
    pub ignored_invalid_feed_ids: InvalidFeedSubscriptionDetails,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsubscribedResponse {
    pub subscription_id: SubscriptionId,
}

/// Sent from the server if the requested subscription or unsubscription request
/// could not be fulfilled.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionErrorResponse {
    pub subscription_id: SubscriptionId,
    pub error: String,
}

/// Sent from the server if an internal error occured while serving data for an existing subscription,
/// or a client request sent a bad request.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub error: String,
}

/// Sent from the server when new data is available for an existing subscription
/// (only if `delivery_format == Json`).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamUpdatedResponse {
    pub subscription_id: SubscriptionId,
    #[serde(flatten)]
    pub payload: JsonUpdate,
}
