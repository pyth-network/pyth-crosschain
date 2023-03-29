use {
    crate::PriceAccount,
    anchor_lang::prelude::*,
    bytemuck::{
        Pod,
        Zeroable,
    },
    std::io::Write,
};

// TODO: should these schemas be "external" (protobuf?)

#[repr(C)]
#[derive(Debug, Copy, Clone, Pod, Zeroable)]
pub struct PriceCompact {
    pub price_expo: u64,
    pub price:      u64,
    pub id:         u64,
}


impl AccumulatorSerializer for PriceCompact {
    fn accumulator_serialize(&self) -> Result<Vec<u8>> {
        let mut bytes = vec![];
        bytes.write_all(&self.id.to_be_bytes())?;
        bytes.write_all(&self.price.to_be_bytes())?;
        bytes.write_all(&self.price_expo.to_be_bytes())?;
        Ok(bytes)
    }
}

impl From<&PriceAccount> for PriceCompact {
    fn from(other: &PriceAccount) -> Self {
        Self {
            id:         other.id,
            price:      other.price,
            price_expo: other.price_expo,
        }
    }
}


#[repr(C)]
#[derive(Debug, Copy, Clone, Pod, Zeroable)]
pub struct PriceFull {
    pub id:         u64,
    pub price:      u64,
    pub price_expo: u64,
    pub ema:        u64,
    pub ema_expo:   u64,
}

impl From<&PriceAccount> for PriceFull {
    fn from(other: &PriceAccount) -> Self {
        Self {
            id:         other.id,
            price:      other.price,
            price_expo: other.price_expo,
            ema:        other.ema,
            ema_expo:   other.ema_expo,
        }
    }
}

pub trait AccumulatorSerializer {
    fn accumulator_serialize(&self) -> Result<Vec<u8>>;
}

impl AccumulatorSerializer for PriceFull {
    fn accumulator_serialize(&self) -> Result<Vec<u8>> {
        let mut bytes = vec![];
        bytes.write_all(&self.id.to_be_bytes())?;
        bytes.write_all(&self.price.to_be_bytes())?;
        bytes.write_all(&self.price_expo.to_be_bytes())?;
        bytes.write_all(&self.ema.to_be_bytes())?;
        bytes.write_all(&self.ema_expo.to_be_bytes())?;
        Ok(bytes)
    }
}
