use crate::{
    api::MarketSession,
    price::Price,
    rate::Rate,
    time::{DurationUs, TimestampUs},
    ChannelId, PriceFeedId, PriceFeedProperty,
};
use {
    anyhow::bail,
    byteorder::{ByteOrder, ReadBytesExt, WriteBytesExt, BE, LE},
    serde::{Deserialize, Serialize},
    std::{
        io::{Cursor, Read, Write},
        num::NonZeroI64,
    },
};

/// Data contained within a signable payload.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PayloadData {
    pub timestamp_us: TimestampUs,
    pub channel_id: ChannelId,
    // TODO: smallvec?
    pub feeds: Vec<PayloadFeedData>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PayloadFeedData {
    pub feed_id: PriceFeedId,
    // TODO: smallvec?
    pub properties: Vec<PayloadPropertyValue>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum PayloadPropertyValue {
    Price(Option<Price>),
    BestBidPrice(Option<Price>),
    BestAskPrice(Option<Price>),
    PublisherCount(u16),
    Exponent(i16),
    Confidence(Option<Price>),
    FundingRate(Option<Rate>),
    FundingTimestamp(Option<TimestampUs>),
    FundingRateInterval(Option<DurationUs>),
    MarketSession(MarketSession),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AggregatedPriceFeedData {
    pub price: Option<Price>,
    pub best_bid_price: Option<Price>,
    pub best_ask_price: Option<Price>,
    pub publisher_count: u16,
    pub exponent: i16,
    pub confidence: Option<Price>,
    pub funding_rate: Option<Rate>,
    pub funding_timestamp: Option<TimestampUs>,
    pub funding_rate_interval: Option<DurationUs>,
    pub market_session: MarketSession,
}

impl AggregatedPriceFeedData {
    pub fn empty(exponent: i16, market_session: MarketSession) -> Self {
        Self {
            price: None,
            best_bid_price: None,
            best_ask_price: None,
            publisher_count: 0,
            exponent,
            confidence: None,
            funding_rate: None,
            funding_timestamp: None,
            funding_rate_interval: None,
            market_session,
        }
    }
}

/// First bytes of a payload's encoding
/// (in LE or BE depending on the byte order used for encoding the rest of the payload)
pub const PAYLOAD_FORMAT_MAGIC: u32 = 2479346549;

impl PayloadData {
    pub fn new(
        timestamp_us: TimestampUs,
        channel_id: ChannelId,
        feeds: &[(PriceFeedId, AggregatedPriceFeedData)],
        requested_properties: &[PriceFeedProperty],
    ) -> Self {
        Self {
            timestamp_us,
            channel_id,
            feeds: feeds
                .iter()
                .map(|(feed_id, feed)| PayloadFeedData {
                    feed_id: *feed_id,
                    properties: requested_properties
                        .iter()
                        .map(|property| match property {
                            PriceFeedProperty::Price => PayloadPropertyValue::Price(feed.price),
                            PriceFeedProperty::BestBidPrice => {
                                PayloadPropertyValue::BestBidPrice(feed.best_bid_price)
                            }
                            PriceFeedProperty::BestAskPrice => {
                                PayloadPropertyValue::BestAskPrice(feed.best_ask_price)
                            }
                            PriceFeedProperty::PublisherCount => {
                                PayloadPropertyValue::PublisherCount(feed.publisher_count)
                            }
                            PriceFeedProperty::Exponent => {
                                PayloadPropertyValue::Exponent(feed.exponent)
                            }
                            PriceFeedProperty::Confidence => {
                                PayloadPropertyValue::Confidence(feed.confidence)
                            }
                            PriceFeedProperty::FundingRate => {
                                PayloadPropertyValue::FundingRate(feed.funding_rate)
                            }
                            PriceFeedProperty::FundingTimestamp => {
                                PayloadPropertyValue::FundingTimestamp(feed.funding_timestamp)
                            }
                            PriceFeedProperty::FundingRateInterval => {
                                PayloadPropertyValue::FundingRateInterval(
                                    feed.funding_rate_interval,
                                )
                            }
                            PriceFeedProperty::MarketSession => {
                                PayloadPropertyValue::MarketSession(feed.market_session)
                            }
                        })
                        .collect(),
                })
                .collect(),
        }
    }

    pub fn serialize<BO: ByteOrder>(&self, mut writer: impl Write) -> anyhow::Result<()> {
        writer.write_u32::<BO>(PAYLOAD_FORMAT_MAGIC)?;
        writer.write_u64::<BO>(self.timestamp_us.as_micros())?;
        writer.write_u8(self.channel_id.0)?;
        writer.write_u8(self.feeds.len().try_into()?)?;
        for feed in &self.feeds {
            writer.write_u32::<BO>(feed.feed_id.0)?;
            writer.write_u8(feed.properties.len().try_into()?)?;
            for property in &feed.properties {
                match property {
                    PayloadPropertyValue::Price(price) => {
                        writer.write_u8(PriceFeedProperty::Price as u8)?;
                        write_option_price::<BO>(&mut writer, *price)?;
                    }
                    PayloadPropertyValue::BestBidPrice(price) => {
                        writer.write_u8(PriceFeedProperty::BestBidPrice as u8)?;
                        write_option_price::<BO>(&mut writer, *price)?;
                    }
                    PayloadPropertyValue::BestAskPrice(price) => {
                        writer.write_u8(PriceFeedProperty::BestAskPrice as u8)?;
                        write_option_price::<BO>(&mut writer, *price)?;
                    }
                    PayloadPropertyValue::PublisherCount(count) => {
                        writer.write_u8(PriceFeedProperty::PublisherCount as u8)?;
                        writer.write_u16::<BO>(*count)?;
                    }
                    PayloadPropertyValue::Exponent(exponent) => {
                        writer.write_u8(PriceFeedProperty::Exponent as u8)?;
                        writer.write_i16::<BO>(*exponent)?;
                    }
                    PayloadPropertyValue::Confidence(confidence) => {
                        writer.write_u8(PriceFeedProperty::Confidence as u8)?;
                        write_option_price::<BO>(&mut writer, *confidence)?;
                    }
                    PayloadPropertyValue::FundingRate(rate) => {
                        writer.write_u8(PriceFeedProperty::FundingRate as u8)?;
                        write_option_rate::<BO>(&mut writer, *rate)?;
                    }
                    PayloadPropertyValue::FundingTimestamp(timestamp) => {
                        writer.write_u8(PriceFeedProperty::FundingTimestamp as u8)?;
                        write_option_timestamp::<BO>(&mut writer, *timestamp)?;
                    }
                    &PayloadPropertyValue::FundingRateInterval(interval) => {
                        writer.write_u8(PriceFeedProperty::FundingRateInterval as u8)?;
                        write_option_duration::<BO>(&mut writer, interval)?;
                    }
                    PayloadPropertyValue::MarketSession(market_session) => {
                        writer.write_u8(PriceFeedProperty::MarketSession as u8)?;
                        writer.write_i16::<BO>((*market_session).into())?;
                    }
                }
            }
        }
        Ok(())
    }

    pub fn deserialize_slice_le(data: &[u8]) -> anyhow::Result<Self> {
        Self::deserialize::<LE>(Cursor::new(data))
    }

    pub fn deserialize_slice_be(data: &[u8]) -> anyhow::Result<Self> {
        Self::deserialize::<BE>(Cursor::new(data))
    }

    pub fn deserialize<BO: ByteOrder>(mut reader: impl Read) -> anyhow::Result<Self> {
        let magic = reader.read_u32::<BO>()?;
        if magic != PAYLOAD_FORMAT_MAGIC {
            bail!("magic mismatch");
        }
        let timestamp_us = TimestampUs::from_micros(reader.read_u64::<BO>()?);
        let channel_id = ChannelId(reader.read_u8()?);
        let num_feeds = reader.read_u8()?;
        let mut feeds = Vec::with_capacity(num_feeds.into());
        for _ in 0..num_feeds {
            let feed_id = PriceFeedId(reader.read_u32::<BO>()?);
            let num_properties = reader.read_u8()?;
            let mut feed = PayloadFeedData {
                feed_id,
                properties: Vec::with_capacity(num_properties.into()),
            };
            for _ in 0..num_properties {
                let property = reader.read_u8()?;
                let value = if property == PriceFeedProperty::Price as u8 {
                    PayloadPropertyValue::Price(read_option_price::<BO>(&mut reader)?)
                } else if property == PriceFeedProperty::BestBidPrice as u8 {
                    PayloadPropertyValue::BestBidPrice(read_option_price::<BO>(&mut reader)?)
                } else if property == PriceFeedProperty::BestAskPrice as u8 {
                    PayloadPropertyValue::BestAskPrice(read_option_price::<BO>(&mut reader)?)
                } else if property == PriceFeedProperty::PublisherCount as u8 {
                    PayloadPropertyValue::PublisherCount(reader.read_u16::<BO>()?)
                } else if property == PriceFeedProperty::Exponent as u8 {
                    PayloadPropertyValue::Exponent(reader.read_i16::<BO>()?)
                } else if property == PriceFeedProperty::Confidence as u8 {
                    PayloadPropertyValue::Confidence(read_option_price::<BO>(&mut reader)?)
                } else if property == PriceFeedProperty::FundingRate as u8 {
                    PayloadPropertyValue::FundingRate(read_option_rate::<BO>(&mut reader)?)
                } else if property == PriceFeedProperty::FundingTimestamp as u8 {
                    PayloadPropertyValue::FundingTimestamp(read_option_timestamp::<BO>(
                        &mut reader,
                    )?)
                } else if property == PriceFeedProperty::FundingRateInterval as u8 {
                    PayloadPropertyValue::FundingRateInterval(read_option_interval::<BO>(
                        &mut reader,
                    )?)
                } else if property == PriceFeedProperty::MarketSession as u8 {
                    PayloadPropertyValue::MarketSession(reader.read_i16::<BO>()?.try_into()?)
                } else {
                    bail!("unknown property");
                };
                feed.properties.push(value);
            }
            feeds.push(feed);
        }
        Ok(Self {
            timestamp_us,
            channel_id,
            feeds,
        })
    }
}

fn write_option_price<BO: ByteOrder>(
    mut writer: impl Write,
    value: Option<Price>,
) -> std::io::Result<()> {
    writer.write_i64::<BO>(value.map_or(0, |v| v.mantissa_i64()))
}

fn read_option_price<BO: ByteOrder>(mut reader: impl Read) -> std::io::Result<Option<Price>> {
    let value = NonZeroI64::new(reader.read_i64::<BO>()?);
    Ok(value.map(Price::from_nonzero_mantissa))
}

fn write_option_rate<BO: ByteOrder>(
    mut writer: impl Write,
    value: Option<Rate>,
) -> std::io::Result<()> {
    match value {
        Some(value) => {
            writer.write_u8(1)?;
            writer.write_i64::<BO>(value.mantissa())
        }
        None => {
            writer.write_u8(0)?;
            Ok(())
        }
    }
}

fn read_option_rate<BO: ByteOrder>(mut reader: impl Read) -> std::io::Result<Option<Rate>> {
    let present = reader.read_u8()? != 0;
    if present {
        Ok(Some(Rate::from_mantissa(reader.read_i64::<BO>()?)))
    } else {
        Ok(None)
    }
}

fn write_option_timestamp<BO: ByteOrder>(
    mut writer: impl Write,
    value: Option<TimestampUs>,
) -> std::io::Result<()> {
    match value {
        Some(value) => {
            writer.write_u8(1)?;
            writer.write_u64::<BO>(value.as_micros())
        }
        None => {
            writer.write_u8(0)?;
            Ok(())
        }
    }
}

fn read_option_timestamp<BO: ByteOrder>(
    mut reader: impl Read,
) -> std::io::Result<Option<TimestampUs>> {
    let present = reader.read_u8()? != 0;
    if present {
        Ok(Some(TimestampUs::from_micros(reader.read_u64::<BO>()?)))
    } else {
        Ok(None)
    }
}

fn write_option_duration<BO: ByteOrder>(
    mut writer: impl Write,
    value: Option<DurationUs>,
) -> std::io::Result<()> {
    match value {
        Some(value) => {
            writer.write_u8(1)?;
            writer.write_u64::<BO>(value.as_micros())
        }
        None => {
            writer.write_u8(0)?;
            Ok(())
        }
    }
}

fn read_option_interval<BO: ByteOrder>(
    mut reader: impl Read,
) -> std::io::Result<Option<DurationUs>> {
    let present = reader.read_u8()? != 0;
    if present {
        Ok(Some(DurationUs::from_micros(reader.read_u64::<BO>()?)))
    } else {
        Ok(None)
    }
}
