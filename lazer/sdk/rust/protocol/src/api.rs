use std::{
    cmp::Ordering,
    fmt::Display,
    ops::{Deref, DerefMut},
};

use derive_more::derive::From;
use itertools::Itertools as _;
use serde::{de::Error, Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    payload::AggregatedPriceFeedData,
    time::{DurationUs, FixedRate, TimestampUs},
    ChannelId, Price, PriceFeedId, PriceFeedProperty, Rate,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LatestPriceRequestRepr {
    // Either price feed ids or symbols must be specified.
    #[schema(example = json!([1]))]
    pub price_feed_ids: Option<Vec<PriceFeedId>>,
    #[schema(example = schema_default_symbols)]
    pub symbols: Option<Vec<String>>,
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
    #[serde(default = "default_market_sessions")]
    pub market_sessions: Vec<MarketSession>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LatestPriceRequest(LatestPriceRequestRepr);

impl<'de> Deserialize<'de> for LatestPriceRequest {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = LatestPriceRequestRepr::deserialize(deserializer)?;
        Self::new(value).map_err(Error::custom)
    }
}

impl LatestPriceRequest {
    pub fn new(value: LatestPriceRequestRepr) -> Result<Self, &'static str> {
        validate_price_feed_ids_or_symbols(&value.price_feed_ids, &value.symbols)?;
        validate_optional_nonempty_vec_has_unique_elements(
            &value.price_feed_ids,
            "no price feed ids specified",
            "duplicate price feed ids specified",
        )?;
        validate_optional_nonempty_vec_has_unique_elements(
            &value.symbols,
            "no symbols specified",
            "duplicate symbols specified",
        )?;
        validate_formats(&value.formats)?;
        validate_properties(&value.properties)?;
        Ok(Self(value))
    }
}

impl Deref for LatestPriceRequest {
    type Target = LatestPriceRequestRepr;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl DerefMut for LatestPriceRequest {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceRequestRepr {
    pub timestamp: TimestampUs,
    // Either price feed ids or symbols must be specified.
    pub price_feed_ids: Option<Vec<PriceFeedId>>,
    #[schema(default)]
    pub symbols: Option<Vec<String>>,
    pub properties: Vec<PriceFeedProperty>,
    pub formats: Vec<Format>,
    #[serde(default)]
    pub json_binary_encoding: JsonBinaryEncoding,
    /// If `true`, the stream update will contain a JSON object containing
    /// all data of the update.
    #[serde(default = "default_parsed")]
    pub parsed: bool,
    pub channel: Channel,
    #[serde(default = "default_market_sessions")]
    pub market_sessions: Vec<MarketSession>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceRequest(PriceRequestRepr);

impl<'de> Deserialize<'de> for PriceRequest {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = PriceRequestRepr::deserialize(deserializer)?;
        Self::new(value).map_err(Error::custom)
    }
}

impl PriceRequest {
    pub fn new(value: PriceRequestRepr) -> Result<Self, &'static str> {
        validate_price_feed_ids_or_symbols(&value.price_feed_ids, &value.symbols)?;
        validate_optional_nonempty_vec_has_unique_elements(
            &value.price_feed_ids,
            "no price feed ids specified",
            "duplicate price feed ids specified",
        )?;
        validate_optional_nonempty_vec_has_unique_elements(
            &value.symbols,
            "no symbols specified",
            "duplicate symbols specified",
        )?;
        validate_formats(&value.formats)?;
        validate_properties(&value.properties)?;
        Ok(Self(value))
    }
}

impl Deref for PriceRequest {
    type Target = PriceRequestRepr;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl DerefMut for PriceRequest {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
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

pub fn default_market_sessions() -> Vec<MarketSession> {
    vec![
        MarketSession::Regular,
        MarketSession::PreMarket,
        MarketSession::PostMarket,
        MarketSession::OverNight,
        MarketSession::Closed,
    ]
}

pub fn schema_default_symbols() -> Option<Vec<String>> {
    None
}
pub fn schema_default_price_feed_ids() -> Option<Vec<PriceFeedId>> {
    Some(vec![PriceFeedId(1)])
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum DeliveryFormat {
    /// Deliver stream updates as JSON text messages.
    #[default]
    Json,
    /// Deliver stream updates as binary messages.
    Binary,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum Format {
    Evm,
    Solana,
    LeEcdsa,
    LeUnsigned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum JsonBinaryEncoding {
    #[default]
    Base64,
    Hex,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, From, ToSchema)]
#[schema(example = "fixed_rate@200ms")]
pub enum Channel {
    FixedRate(FixedRate),
    #[schema(rename = "real_time")]
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
                50 => ChannelId::FIXED_RATE_50,
                200 => ChannelId::FIXED_RATE_200,
                1000 => ChannelId::FIXED_RATE_1000,
                _ => panic!("unknown channel: {self:?}"),
            },
            Channel::RealTime => ChannelId::REAL_TIME,
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

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionParamsRepr {
    // Either price feed ids or symbols must be specified.
    pub price_feed_ids: Option<Vec<PriceFeedId>>,
    #[schema(default)]
    pub symbols: Option<Vec<String>>,
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
    // "ignoreInvalidFeedIds" was renamed to "ignoreInvalidFeeds". "ignoreInvalidFeedIds" is still supported for compatibility.
    #[serde(default, alias = "ignoreInvalidFeedIds")]
    pub ignore_invalid_feeds: bool,
    // Market sessions to filter price feeds by. Default to [Regular] for backward compatibility.
    #[serde(default = "default_market_sessions")]
    pub market_sessions: Vec<MarketSession>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, ToSchema)]
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
        validate_price_feed_ids_or_symbols(&value.price_feed_ids, &value.symbols)?;
        validate_optional_nonempty_vec_has_unique_elements(
            &value.price_feed_ids,
            "no price feed ids specified",
            "duplicate price feed ids specified",
        )?;
        validate_optional_nonempty_vec_has_unique_elements(
            &value.symbols,
            "no symbols specified",
            "duplicate symbols specified",
        )?;
        validate_formats(&value.formats)?;
        validate_properties(&value.properties)?;
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

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct JsonBinaryData {
    pub encoding: JsonBinaryEncoding,
    pub data: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
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

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ParsedPayload {
    #[serde(with = "crate::serde_str::timestamp")]
    pub timestamp_us: TimestampUs,
    pub price_feeds: Vec<ParsedFeedPayload>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
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
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub market_session: Option<MarketSession>,
}

impl ParsedFeedPayload {
    pub fn new(
        price_feed_id: PriceFeedId,
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
            market_session: None,
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
                    output.exponent = Some(data.exponent);
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
                PriceFeedProperty::MarketSession => {
                    output.market_session = Some(data.market_session);
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
            market_session: Some(data.market_session),
        }
    }
}

/// A request sent from the client to the server.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type")]
#[serde(rename_all = "camelCase")]
pub enum WsRequest {
    Subscribe(SubscribeRequest),
    Unsubscribe(UnsubscribeRequest),
}

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, ToSchema,
)]
pub struct SubscriptionId(pub u64);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeRequest {
    pub subscription_id: SubscriptionId,
    #[serde(flatten)]
    pub params: SubscriptionParams,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UnsubscribeRequest {
    pub subscription_id: SubscriptionId,
}

/// A JSON response sent from the server to the client.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, From, ToSchema)]
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
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubscribedResponse {
    pub subscription_id: SubscriptionId,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InvalidFeedSubscriptionDetails {
    pub unknown_ids: Vec<PriceFeedId>,
    pub unknown_symbols: Vec<String>,
    pub unsupported_channels: Vec<PriceFeedId>,
    pub unstable: Vec<PriceFeedId>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubscribedWithInvalidFeedIdsIgnoredResponse {
    pub subscription_id: SubscriptionId,
    pub subscribed_feed_ids: Vec<PriceFeedId>,
    pub ignored_invalid_feed_ids: InvalidFeedSubscriptionDetails,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UnsubscribedResponse {
    pub subscription_id: SubscriptionId,
}

/// Sent from the server if the requested subscription or unsubscription request
/// could not be fulfilled.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionErrorResponse {
    pub subscription_id: SubscriptionId,
    pub error: String,
}

/// Sent from the server if an internal error occured while serving data for an existing subscription,
/// or a client request sent a bad request.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub error: String,
}

/// Sent from the server when new data is available for an existing subscription
/// (only if `delivery_format == Json`).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StreamUpdatedResponse {
    pub subscription_id: SubscriptionId,
    #[serde(flatten)]
    pub payload: JsonUpdate,
}

// Common validation functions
fn validate_price_feed_ids_or_symbols(
    price_feed_ids: &Option<Vec<PriceFeedId>>,
    symbols: &Option<Vec<String>>,
) -> Result<(), &'static str> {
    if price_feed_ids.is_none() && symbols.is_none() {
        return Err("either price feed ids or symbols must be specified");
    }
    if price_feed_ids.is_some() && symbols.is_some() {
        return Err("either price feed ids or symbols must be specified, not both");
    }
    Ok(())
}

fn validate_optional_nonempty_vec_has_unique_elements<T>(
    vec: &Option<Vec<T>>,
    empty_msg: &'static str,
    duplicate_msg: &'static str,
) -> Result<(), &'static str>
where
    T: Eq + std::hash::Hash,
{
    if let Some(ref items) = vec {
        if items.is_empty() {
            return Err(empty_msg);
        }
        if !items.iter().all_unique() {
            return Err(duplicate_msg);
        }
    }
    Ok(())
}

fn validate_properties(properties: &[PriceFeedProperty]) -> Result<(), &'static str> {
    if properties.is_empty() {
        return Err("no properties specified");
    }
    if !properties.iter().all_unique() {
        return Err("duplicate properties specified");
    }
    Ok(())
}

fn validate_formats(formats: &[Format]) -> Result<(), &'static str> {
    if !formats.iter().all_unique() {
        return Err("duplicate formats or chains specified");
    }
    Ok(())
}

#[derive(
    Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash, From, ToSchema, Default,
)]
#[serde(rename_all = "camelCase")]
#[schema(example = "regular")]
pub enum MarketSession {
    #[default]
    Regular,
    PreMarket,
    PostMarket,
    OverNight,
    Closed,
}

impl From<MarketSession> for i16 {
    fn from(s: MarketSession) -> i16 {
        match s {
            MarketSession::Regular => 0,
            MarketSession::PreMarket => 1,
            MarketSession::PostMarket => 2,
            MarketSession::OverNight => 3,
            MarketSession::Closed => 4,
        }
    }
}

impl TryFrom<i16> for MarketSession {
    type Error = anyhow::Error;

    fn try_from(value: i16) -> Result<MarketSession, Self::Error> {
        match value {
            0 => Ok(MarketSession::Regular),
            1 => Ok(MarketSession::PreMarket),
            2 => Ok(MarketSession::PostMarket),
            3 => Ok(MarketSession::OverNight),
            4 => Ok(MarketSession::Closed),
            _ => Err(anyhow::anyhow!("invalid MarketSession value: {}", value)),
        }
    }
}
