extern crate alloc;

use alloc::vec::Vec;
use soroban_sdk::Bytes;

use crate::error::ContractError;

// TODO: this payload parsing code needs to be a library or something that users can integrate
// in their contract.

/// Payload magic number (LE u32 = 0x93C7D375 = 2479346549).
const PAYLOAD_MAGIC: u32 = 2_479_346_549;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Channel {
    RealTime,
    FixedRate50ms,
    FixedRate200ms,
    FixedRate1000ms,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MarketSession {
    Regular,
    PreMarket,
    PostMarket,
    OverNight,
    Closed,
}

/// Parsed price feed data.
///
/// Each field is `Option<T>` where `None` means the property was either not
/// present in the payload or had an absent/zero value. For properties with an
/// explicit "exists" flag on the wire (funding_rate, funding_timestamp,
/// funding_rate_interval, feed_update_timestamp), `None` means the flag was
/// false or the property was not included.
///
/// Signed integer fields (price, best_bid_price, best_ask_price, confidence,
/// funding_rate, ema_price) are decoded from LE two's complement u64 on the wire.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Feed {
    pub feed_id: u32,
    pub price: Option<i64>,
    pub best_bid_price: Option<i64>,
    pub best_ask_price: Option<i64>,
    pub publisher_count: Option<u16>,
    pub exponent: Option<i16>,
    pub confidence: Option<i64>,
    pub funding_rate: Option<i64>,
    pub funding_timestamp: Option<u64>,
    pub funding_rate_interval: Option<u64>,
    pub market_session: Option<MarketSession>,
    pub ema_price: Option<i64>,
    pub ema_confidence: Option<u64>,
    pub feed_update_timestamp: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Update {
    pub timestamp: u64,
    pub channel: Channel,
    pub feeds: Vec<Feed>,
}

/// Cursor for reading little-endian values from Soroban Bytes.
struct Reader<'a> {
    data: &'a Bytes,
    offset: u32,
}

impl<'a> Reader<'a> {
    fn new(data: &'a Bytes) -> Self {
        Self { data, offset: 0 }
    }

    fn remaining(&self) -> u32 {
        self.data.len().saturating_sub(self.offset)
    }

    fn read_u8(&mut self) -> Result<u8, ContractError> {
        if self.offset >= self.data.len() {
            return Err(ContractError::TruncatedData);
        }
        let val = self.data.get(self.offset).unwrap();
        self.offset += 1;
        Ok(val)
    }

    fn read_bool(&mut self) -> Result<bool, ContractError> {
        Ok(self.read_u8()? != 0)
    }

    fn read_le_u16(&mut self) -> Result<u16, ContractError> {
        if self.remaining() < 2 {
            return Err(ContractError::TruncatedData);
        }
        let b0 = self.data.get(self.offset).unwrap() as u16;
        let b1 = self.data.get(self.offset + 1).unwrap() as u16;
        self.offset += 2;
        Ok(b0 | (b1 << 8))
    }

    fn read_le_u32(&mut self) -> Result<u32, ContractError> {
        if self.remaining() < 4 {
            return Err(ContractError::TruncatedData);
        }
        let b0 = self.data.get(self.offset).unwrap() as u32;
        let b1 = self.data.get(self.offset + 1).unwrap() as u32;
        let b2 = self.data.get(self.offset + 2).unwrap() as u32;
        let b3 = self.data.get(self.offset + 3).unwrap() as u32;
        self.offset += 4;
        Ok(b0 | (b1 << 8) | (b2 << 16) | (b3 << 24))
    }

    fn read_le_u64(&mut self) -> Result<u64, ContractError> {
        if self.remaining() < 8 {
            return Err(ContractError::TruncatedData);
        }
        let mut val = 0u64;
        for i in 0..8u32 {
            val |= (self.data.get(self.offset + i).unwrap() as u64) << (i * 8);
        }
        self.offset += 8;
        Ok(val)
    }
}

fn parse_channel(value: u8) -> Result<Channel, ContractError> {
    match value {
        1 => Ok(Channel::RealTime),
        2 => Ok(Channel::FixedRate50ms),
        3 => Ok(Channel::FixedRate200ms),
        4 => Ok(Channel::FixedRate1000ms),
        _ => Err(ContractError::InvalidChannel),
    }
}

fn parse_market_session(value: u16) -> Result<MarketSession, ContractError> {
    match value {
        0 => Ok(MarketSession::Regular),
        1 => Ok(MarketSession::PreMarket),
        2 => Ok(MarketSession::PostMarket),
        3 => Ok(MarketSession::OverNight),
        4 => Ok(MarketSession::Closed),
        _ => Err(ContractError::InvalidMarketSession),
    }
}

/// Read a u64 from the wire and reinterpret as i64 (two's complement).
/// Returns None if the raw value is 0 (convention for absent values).
fn read_optional_i64(reader: &mut Reader) -> Result<Option<i64>, ContractError> {
    let raw = reader.read_le_u64()?;
    if raw == 0 {
        Ok(None)
    } else {
        Ok(Some(raw as i64))
    }
}

fn parse_feed(reader: &mut Reader) -> Result<Feed, ContractError> {
    let feed_id = reader.read_le_u32()?;
    let num_properties = reader.read_u8()?;

    let mut feed = Feed {
        feed_id,
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
        ema_price: None,
        ema_confidence: None,
        feed_update_timestamp: None,
    };

    for _ in 0..num_properties {
        let property_id = reader.read_u8()?;
        match property_id {
            0 => {
                // Price: u64 on wire, reinterpret as i64; 0 = absent
                feed.price = read_optional_i64(reader)?;
            }
            1 => {
                // BestBidPrice
                feed.best_bid_price = read_optional_i64(reader)?;
            }
            2 => {
                // BestAskPrice
                feed.best_ask_price = read_optional_i64(reader)?;
            }
            3 => {
                // PublisherCount: u16
                feed.publisher_count = Some(reader.read_le_u16()?);
            }
            4 => {
                // Exponent: u16 on wire, reinterpret as i16 (two's complement)
                let raw = reader.read_le_u16()?;
                feed.exponent = Some(raw as i16);
            }
            5 => {
                // Confidence: u64 on wire, reinterpret as i64; 0 = absent
                feed.confidence = read_optional_i64(reader)?;
            }
            6 => {
                // FundingRate: bool exists flag + u64
                if reader.read_bool()? {
                    let raw = reader.read_le_u64()?;
                    feed.funding_rate = Some(raw as i64);
                }
            }
            7 => {
                // FundingTimestamp: bool exists flag + u64
                if reader.read_bool()? {
                    feed.funding_timestamp = Some(reader.read_le_u64()?);
                }
            }
            8 => {
                // FundingRateInterval: bool exists flag + u64
                if reader.read_bool()? {
                    feed.funding_rate_interval = Some(reader.read_le_u64()?);
                }
            }
            9 => {
                // MarketSession: u16
                let raw = reader.read_le_u16()?;
                feed.market_session = Some(parse_market_session(raw)?);
            }
            10 => {
                // EmaPrice: u64 on wire, reinterpret as i64; 0 = absent
                feed.ema_price = read_optional_i64(reader)?;
            }
            11 => {
                // EmaConfidence: u64; 0 = absent
                let raw = reader.read_le_u64()?;
                feed.ema_confidence = if raw == 0 { None } else { Some(raw) };
            }
            12 => {
                // FeedUpdateTimestamp: bool exists flag + u64
                if reader.read_bool()? {
                    feed.feed_update_timestamp = Some(reader.read_le_u64()?);
                }
            }
            _ => {
                return Err(ContractError::InvalidProperty);
            }
        }
    }

    Ok(feed)
}

/// Parse verified payload bytes into a structured Update.
///
/// The payload format (all integers little-endian):
/// - 4 bytes: magic (0x93C7D375)
/// - 8 bytes: timestamp (u64, microseconds)
/// - 1 byte: channel
/// - 1 byte: number of feeds
/// - For each feed:
///   - 4 bytes: feed_id (u32)
///   - 1 byte: number of properties
///   - For each property: 1 byte property_id, then type-specific value bytes
pub fn parse_payload(payload: &Bytes) -> Result<Update, ContractError> {
    let mut reader = Reader::new(payload);

    let magic = reader.read_le_u32()?;
    if magic != PAYLOAD_MAGIC {
        return Err(ContractError::InvalidPayloadMagic);
    }

    let timestamp = reader.read_le_u64()?;

    let channel_value = reader.read_u8()?;
    let channel = parse_channel(channel_value)?;

    let num_feeds = reader.read_u8()?;
    let mut feeds = Vec::with_capacity(num_feeds as usize);

    for _ in 0..num_feeds {
        feeds.push(parse_feed(&mut reader)?);
    }

    if reader.remaining() != 0 {
        return Err(ContractError::InvalidPayloadLength);
    }

    Ok(Update {
        timestamp,
        channel,
        feeds,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    /// Payload extracted from the shared Sui/Stellar test vector (TEST_LAZER_UPDATE bytes 71+).
    /// Contains 3 feeds (BTC/USD id=1, ETH/USD id=2, SOL/USD id=112) with 11 properties each.
    fn test_payload_bytes(env: &Env) -> Bytes {
        Bytes::from_slice(
            env,
            &hex_literal::hex!(
                "75d3c7934067e9c7f14a06000303010000000b00e1637ad5"
                "35060000015a2507d335060000027f8bfdf53506000004f8"
                "ff0600070008000900000a601299cd3e0600000bc07595c7"
                "3e0600000c014067e9c7f14a0600020000000b00971b209c"
                "2d0000000144056b9b2d0000000298fb6b9c2d00000004f8"
                "ff0600070008000900000a284444f92d0000000b480c07f9"
                "2d0000000c014067e9c7f14a0600700000000b0020d85dd2"
                "d78df30001000000000000000002000000000000000004f4"
                "ff060130f80bfeffffffff0701b8ab7057ec4a0600080100"
                "209db4060000000900000a00000000000000000b00000000"
                "000000000c014067e9c7f14a0600"
            ),
        )
    }

    #[test]
    fn test_parse_payload_success() {
        let env = Env::default();
        let payload = test_payload_bytes(&env);
        let update = parse_payload(&payload).unwrap();

        assert_eq!(update.timestamp, 1_771_252_161_800_000);
        assert_eq!(update.channel, Channel::FixedRate200ms);
        assert_eq!(update.feeds.len(), 3);
    }

    #[test]
    fn test_parse_feed_1_btc() {
        let env = Env::default();
        let payload = test_payload_bytes(&env);
        let update = parse_payload(&payload).unwrap();
        let feed = &update.feeds[0];

        assert_eq!(feed.feed_id, 1);
        assert_eq!(feed.price, Some(6_828_284_601_313));
        assert_eq!(feed.best_bid_price, Some(6_828_243_494_234));
        assert_eq!(feed.best_ask_price, Some(6_828_830_067_583));
        assert_eq!(feed.exponent, Some(-8));
        assert_eq!(feed.publisher_count, None); // not in payload
        assert_eq!(feed.confidence, None); // not in payload
        assert_eq!(feed.funding_rate, None); // exists=false
        assert_eq!(feed.funding_timestamp, None); // exists=false
        assert_eq!(feed.funding_rate_interval, None); // exists=false
        assert_eq!(feed.market_session, Some(MarketSession::Regular));
        assert_eq!(feed.ema_price, Some(6_866_807_100_000));
        assert_eq!(feed.ema_confidence, Some(6_866_706_200_000));
        assert_eq!(feed.feed_update_timestamp, Some(1_771_252_161_800_000));
    }

    #[test]
    fn test_parse_feed_2_eth() {
        let env = Env::default();
        let payload = test_payload_bytes(&env);
        let update = parse_payload(&payload).unwrap();
        let feed = &update.feeds[1];

        assert_eq!(feed.feed_id, 2);
        assert_eq!(feed.price, Some(195_892_878_231));
        assert_eq!(feed.best_bid_price, Some(195_881_010_500));
        assert_eq!(feed.best_ask_price, Some(195_897_850_776));
        assert_eq!(feed.exponent, Some(-8));
        assert_eq!(feed.funding_rate, None);
        assert_eq!(feed.funding_timestamp, None);
        assert_eq!(feed.funding_rate_interval, None);
        assert_eq!(feed.market_session, Some(MarketSession::Regular));
        assert_eq!(feed.ema_price, Some(197_455_529_000));
        assert_eq!(feed.ema_confidence, Some(197_451_517_000));
        assert_eq!(feed.feed_update_timestamp, Some(1_771_252_161_800_000));
    }

    #[test]
    fn test_parse_feed_3_with_funding() {
        let env = Env::default();
        let payload = test_payload_bytes(&env);
        let update = parse_payload(&payload).unwrap();
        let feed = &update.feeds[2];

        assert_eq!(feed.feed_id, 112);
        assert_eq!(feed.price, Some(68_554_377_427_540_000));
        // best_bid/ask are 0 on wire → None
        assert_eq!(feed.best_bid_price, None);
        assert_eq!(feed.best_ask_price, None);
        assert_eq!(feed.exponent, Some(-12));
        assert_eq!(feed.funding_rate, Some(-32_770_000));
        assert_eq!(feed.funding_timestamp, Some(1_771_228_800_003_000));
        assert_eq!(feed.funding_rate_interval, Some(28_800_000_000));
        assert_eq!(feed.market_session, Some(MarketSession::Regular));
        // ema_price and ema_confidence are 0 on wire → None
        assert_eq!(feed.ema_price, None);
        assert_eq!(feed.ema_confidence, None);
        assert_eq!(feed.feed_update_timestamp, Some(1_771_252_161_800_000));
    }

    #[test]
    fn test_parse_payload_invalid_magic() {
        let env = Env::default();
        let mut raw = hex_literal::hex!(
            "75d3c7934067e9c7f14a06000303010000000b00e1637ad5"
            "35060000015a2507d335060000027f8bfdf53506000004f8"
            "ff0600070008000900000a601299cd3e0600000bc07595c7"
            "3e0600000c014067e9c7f14a0600020000000b00971b209c"
            "2d0000000144056b9b2d0000000298fb6b9c2d00000004f8"
            "ff0600070008000900000a284444f92d0000000b480c07f9"
            "2d0000000c014067e9c7f14a0600700000000b0020d85dd2"
            "d78df30001000000000000000002000000000000000004f4"
            "ff060130f80bfeffffffff0701b8ab7057ec4a0600080100"
            "209db4060000000900000a00000000000000000b00000000"
            "000000000c014067e9c7f14a0600"
        )
        .to_vec();
        raw[0] = 0xFF; // corrupt magic
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_payload(&payload),
            Err(ContractError::InvalidPayloadMagic)
        );
    }

    #[test]
    fn test_parse_payload_truncated() {
        let env = Env::default();
        // Only 10 bytes — not enough for magic + timestamp
        let payload = Bytes::from_slice(&env, &[0x75, 0xd3, 0xc7, 0x93, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

        assert_eq!(parse_payload(&payload), Err(ContractError::TruncatedData));
    }

    #[test]
    fn test_parse_payload_unknown_property() {
        let env = Env::default();
        // Valid header + 1 feed with 1 unknown property (id=99)
        let payload = Bytes::from_slice(
            &env,
            &hex_literal::hex!(
                "75d3c793"                 // magic
                "4067e9c7f14a0600"         // timestamp
                "01"                       // channel = RealTime
                "01"                       // 1 feed
                "01000000"                 // feed_id = 1
                "01"                       // 1 property
                "63"                       // property_id = 99 (unknown)
                "0000000000000000"         // 8 bytes of data (won't be parsed)
            ),
        );

        assert_eq!(
            parse_payload(&payload),
            Err(ContractError::InvalidProperty)
        );
    }

    #[test]
    fn test_parse_payload_invalid_channel() {
        let env = Env::default();
        let payload = Bytes::from_slice(
            &env,
            &hex_literal::hex!(
                "75d3c793"                 // magic
                "4067e9c7f14a0600"         // timestamp
                "FF"                       // channel = 255 (invalid)
                "00"                       // 0 feeds
            ),
        );

        assert_eq!(
            parse_payload(&payload),
            Err(ContractError::InvalidChannel)
        );
    }

    #[test]
    fn test_parse_payload_trailing_bytes() {
        let env = Env::default();
        let payload = Bytes::from_slice(
            &env,
            &hex_literal::hex!(
                "75d3c793"                 // magic
                "4067e9c7f14a0600"         // timestamp
                "01"                       // channel = RealTime
                "00"                       // 0 feeds
                "FF"                       // unexpected trailing byte
            ),
        );

        assert_eq!(
            parse_payload(&payload),
            Err(ContractError::InvalidPayloadLength)
        );
    }

    #[test]
    fn test_parse_payload_empty_feeds() {
        let env = Env::default();
        let payload = Bytes::from_slice(
            &env,
            &hex_literal::hex!(
                "75d3c793"                 // magic
                "4067e9c7f14a0600"         // timestamp
                "01"                       // channel = RealTime
                "00"                       // 0 feeds
            ),
        );

        let update = parse_payload(&payload).unwrap();
        assert_eq!(update.timestamp, 1_771_252_161_800_000);
        assert_eq!(update.channel, Channel::RealTime);
        assert_eq!(update.feeds.len(), 0);
    }
}
