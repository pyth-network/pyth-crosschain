use {
    crate::{
        message::{AccumulatorSerializer, MessageSchema},
        state::PriceAccount,
    },
    anchor_lang::prelude::*,
    std::io::Write,
};

#[repr(C)]
#[derive(Clone, Default, Debug, Eq, PartialEq)]
pub struct MessageHeader {
    pub schema: u8,
    pub version: u16,
    pub size: u32,
}

impl MessageHeader {
    pub const CURRENT_VERSION: u8 = 2;

    pub fn new(schema: MessageSchema, size: u32) -> Self {
        Self {
            schema: schema.to_u8(),
            version: Self::CURRENT_VERSION as u16,
            size,
        }
    }
}

#[repr(C)]
#[derive(Clone, Default, Debug, Eq, PartialEq)]
pub struct CompactPriceMessage {
    pub header: MessageHeader,
    pub id: u64,
    pub price: u64,
    pub price_expo: u64,
}

impl CompactPriceMessage {
    // size without header
    pub const SIZE: usize = 24;
}

impl AccumulatorSerializer for CompactPriceMessage {
    fn accumulator_serialize(&self) -> Result<Vec<u8>> {
        let mut bytes = vec![];
        bytes.write_all(&self.header.schema.to_be_bytes())?;
        bytes.write_all(&self.header.version.to_be_bytes())?;
        bytes.write_all(&self.header.size.to_be_bytes())?;
        bytes.write_all(&self.id.to_be_bytes())?;
        bytes.write_all(&self.price.to_be_bytes())?;
        bytes.write_all(&self.price_expo.to_be_bytes())?;
        Ok(bytes)
    }
}

impl From<&PriceAccount> for CompactPriceMessage {
    fn from(other: &PriceAccount) -> Self {
        Self {
            header: MessageHeader::new(MessageSchema::Compact, Self::SIZE as u32),
            id: other.id,
            price: other.price,
            price_expo: other.price_expo,
        }
    }
}

#[repr(C)]
#[derive(Clone, Default, Debug, Eq, PartialEq)]
pub struct FullPriceMessage {
    pub header: MessageHeader,
    pub id: u64,
    pub price: u64,
    pub price_expo: u64,
    pub ema: u64,
    pub ema_expo: u64,
}

impl FullPriceMessage {
    pub const SIZE: usize = 40;
}

impl From<&PriceAccount> for FullPriceMessage {
    fn from(other: &PriceAccount) -> Self {
        Self {
            header: MessageHeader::new(MessageSchema::Full, Self::SIZE as u32),
            id: other.id,
            price: other.price,
            price_expo: other.price_expo,
            ema: other.ema,
            ema_expo: other.ema_expo,
        }
    }
}

impl AccumulatorSerializer for FullPriceMessage {
    fn accumulator_serialize(&self) -> Result<Vec<u8>> {
        let mut bytes = vec![];
        bytes.write_all(&self.header.schema.to_be_bytes())?;
        bytes.write_all(&self.header.version.to_be_bytes())?;
        bytes.write_all(&self.header.size.to_be_bytes())?;
        bytes.write_all(&self.id.to_be_bytes())?;
        bytes.write_all(&self.price.to_be_bytes())?;
        bytes.write_all(&self.price_expo.to_be_bytes())?;
        bytes.write_all(&self.ema.to_be_bytes())?;
        bytes.write_all(&self.ema_expo.to_be_bytes())?;
        Ok(bytes)
    }
}

#[repr(C)]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DummyPriceMessage {
    pub header: MessageHeader,
    pub data: Vec<u8>,
}

impl DummyPriceMessage {
    pub const SIZE: usize = 1017;

    pub fn new(msg_size: u16) -> Self {
        Self {
            header: MessageHeader::new(MessageSchema::Dummy, msg_size as u32),
            data: vec![0u8; msg_size as usize],
        }
    }
}

impl AccumulatorSerializer for DummyPriceMessage {
    fn accumulator_serialize(&self) -> Result<Vec<u8>> {
        let mut bytes = vec![];
        bytes.write_all(&self.header.schema.to_be_bytes())?;
        bytes.write_all(&self.header.version.to_be_bytes())?;
        bytes.write_all(&self.header.size.to_be_bytes())?;
        bytes.extend_from_slice(&self.data);
        Ok(bytes)
    }
}
