use core::fmt::{Debug, Formatter};
use core::panic_with_felt252;
use pyth::byte_buffer::ByteBuffer;
use pyth::merkle_tree::read_and_verify_proof;
use pyth::pyth::{Price, PriceFeed, UpdatePriceFeedsError};
use pyth::reader::{Reader, ReaderImpl};
use pyth::util::{u32_as_i32, u64_as_i64, write_i64};

// Stands for PNAU (Pyth Network Accumulator Update)
const ACCUMULATOR_MAGIC: u32 = 0x504e4155;
// Stands for AUWV (Accumulator Update Wormhole Verficiation)
const ACCUMULATOR_WORMHOLE_MAGIC: u32 = 0x41555756;
const MAJOR_VERSION: u8 = 1;
const MINIMUM_ALLOWED_MINOR_VERSION: u8 = 0;

#[derive(Drop, Copy, PartialEq, Serde, Hash, starknet::Store)]
pub struct PriceInfo {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
    pub ema_price: i64,
    pub ema_conf: u64,
}

// TODO: use derives after upgrading cairo
impl DebugPriceInfo of Debug<PriceInfo> {
    fn fmt(self: @PriceInfo, ref f: Formatter) -> Result<(), core::fmt::Error> {
        write!(f, "PriceInfo {{ price: ")?;
        write_i64(ref f, *self.price)?;
        write!(f, ", conf: {}, expo: ", self.conf)?;
        write_i64(ref f, (*self.expo).into())?;
        write!(f, ", publish_time: {}, ema_price: ", self.publish_time)?;
        write_i64(ref f, *self.ema_price)?;
        write!(f, ", ema_conf: {} }}", self.ema_conf)
    }
}

#[cfg(test)]
#[test]
fn test_debug_price_info() {
    let value = PriceInfo {
        price: 2, conf: 3, expo: -4, publish_time: 5, ema_price: 7, ema_conf: 8,
    };
    let expected =
        "PriceInfo { price: 2, conf: 3, expo: -4, publish_time: 5, ema_price: 7, ema_conf: 8 }";
    let actual = format!("{:?}", value);
    assert!(actual == expected);
}

impl DefaultPriceInfo of Default<PriceInfo> {
    fn default() -> PriceInfo {
        PriceInfo { price: 0, conf: 0, expo: 0, publish_time: 0, ema_price: 0, ema_conf: 0 }
    }
}

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
enum UpdateType {
    WormholeMerkle,
}

impl U8TryIntoUpdateType of TryInto<u8, UpdateType> {
    fn try_into(self: u8) -> Option<UpdateType> {
        if self == 0 {
            Option::Some(UpdateType::WormholeMerkle)
        } else {
            Option::None
        }
    }
}

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash)]
enum MessageType {
    PriceFeed,
}

impl U8TryIntoMessageType of TryInto<u8, MessageType> {
    fn try_into(self: u8) -> Option<MessageType> {
        if self == 0 {
            Option::Some(MessageType::PriceFeed)
        } else {
            Option::None
        }
    }
}

#[derive(Drop, Copy, PartialEq, Serde, Hash, starknet::Store)]
pub struct PriceFeedMessage {
    pub price_id: u256,
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
    pub prev_publish_time: u64,
    pub ema_price: i64,
    pub ema_conf: u64,
}

// TODO: use derives after upgrading cairo
impl DebugPriceFeedMessage of Debug<PriceFeedMessage> {
    fn fmt(self: @PriceFeedMessage, ref f: Formatter) -> Result<(), core::fmt::Error> {
        write!(f, "PriceFeedMessage {{ price_id: {}, price: ", self.price_id)?;
        write_i64(ref f, *self.price)?;
        write!(f, ", conf: {}, expo: ", self.conf)?;
        write_i64(ref f, (*self.expo).into())?;
        write!(
            f,
            ", publish_time: {}, prev_publish_time: {}, ema_price: ",
            self.publish_time,
            self.prev_publish_time,
        )?;
        write_i64(ref f, *self.ema_price)?;
        write!(f, ", ema_conf: {} }}", self.ema_conf)
    }
}

#[cfg(test)]
#[test]
fn test_debug_price_feed_message() {
    let value = PriceFeedMessage {
        price_id: 1,
        price: 2,
        conf: 3,
        expo: -4,
        publish_time: 5,
        prev_publish_time: 6,
        ema_price: 7,
        ema_conf: 8,
    };
    let expected =
        "PriceFeedMessage { price_id: 1, price: 2, conf: 3, expo: -4, publish_time: 5, prev_publish_time: 6, ema_price: 7, ema_conf: 8 }";
    let actual = format!("{:?}", value);
    assert!(actual == expected);
}

impl DefaultPriceFeedMessage of Default<PriceFeedMessage> {
    fn default() -> PriceFeedMessage {
        PriceFeedMessage {
            price_id: 0,
            price: 0,
            conf: 0,
            expo: 0,
            publish_time: 0,
            prev_publish_time: 0,
            ema_price: 0,
            ema_conf: 0,
        }
    }
}

pub fn read_and_verify_header(ref reader: Reader) {
    if reader.read_u32() != ACCUMULATOR_MAGIC {
        panic_with_felt252(UpdatePriceFeedsError::InvalidUpdateData.into());
    }
    if reader.read_u8() != MAJOR_VERSION {
        panic_with_felt252(UpdatePriceFeedsError::InvalidUpdateData.into());
    }
    if reader.read_u8() < MINIMUM_ALLOWED_MINOR_VERSION {
        panic_with_felt252(UpdatePriceFeedsError::InvalidUpdateData.into());
    }

    let trailing_header_size = reader.read_u8();
    reader.skip(trailing_header_size.into());

    let update_type: UpdateType = reader
        .read_u8()
        .try_into()
        .expect(UpdatePriceFeedsError::InvalidUpdateData.into());

    match update_type {
        UpdateType::WormholeMerkle => {},
    }
}

pub fn parse_wormhole_proof(payload: ByteBuffer) -> u256 {
    let mut reader = ReaderImpl::new(payload);
    if reader.read_u32() != ACCUMULATOR_WORMHOLE_MAGIC {
        panic_with_felt252(UpdatePriceFeedsError::InvalidUpdateData.into());
    }

    let update_type: UpdateType = reader
        .read_u8()
        .try_into()
        .expect(UpdatePriceFeedsError::InvalidUpdateData.into());

    match update_type {
        UpdateType::WormholeMerkle => {},
    }

    let _slot = reader.read_u64();
    let _ring_size = reader.read_u32();
    reader.read_u160()
}

pub fn read_and_verify_message(ref reader: Reader, root_digest: u256) -> PriceFeedMessage {
    let message_size = reader.read_u16();
    let message = reader.read_byte_array(message_size.into());
    read_and_verify_proof(root_digest, @message, ref reader);

    let mut message_reader = ReaderImpl::new(message);
    let message_type: MessageType = message_reader
        .read_u8()
        .try_into()
        .expect(UpdatePriceFeedsError::InvalidUpdateData.into());

    match message_type {
        MessageType::PriceFeed => {},
    }

    let price_id = message_reader.read_u256();
    let price = u64_as_i64(message_reader.read_u64());
    let conf = message_reader.read_u64();
    let expo = u32_as_i32(message_reader.read_u32());
    let publish_time = message_reader.read_u64();
    let prev_publish_time = message_reader.read_u64();
    let ema_price = u64_as_i64(message_reader.read_u64());
    let ema_conf = message_reader.read_u64();

    PriceFeedMessage {
        price_id, price, conf, expo, publish_time, prev_publish_time, ema_price, ema_conf,
    }
}

impl PriceFeedMessageIntoPriceFeed of Into<PriceFeedMessage, PriceFeed> {
    fn into(self: PriceFeedMessage) -> PriceFeed {
        PriceFeed {
            id: self.price_id,
            price: Price {
                price: self.price,
                conf: self.conf,
                expo: self.expo,
                publish_time: self.publish_time,
            },
            ema_price: Price {
                price: self.ema_price,
                conf: self.ema_conf,
                expo: self.expo,
                publish_time: self.publish_time,
            },
        }
    }
}
