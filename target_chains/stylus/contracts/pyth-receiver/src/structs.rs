use alloc::vec::Vec;
use stylus_sdk::{
    prelude::*,
    storage::{
        StorageU64, StorageI32, StorageI64, StorageU16, StorageFixedBytes, StorageKey
    },
};
use stylus_sdk::alloy_primitives::{U16, FixedBytes,U64, I32, I64, B256, U256, keccak256};
use pythnet_sdk::messages::PriceFeedMessage;

#[derive(Debug)]
#[storage]
pub struct DataSourceStorage {
    pub chain_id: StorageU16,
    pub emitter_address: StorageFixedBytes<32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct DataSource {
    pub chain_id: U16,
    pub emitter_address: FixedBytes<32>,
}

impl StorageKey for DataSourceStorage {
    fn to_slot(&self, root: B256) -> U256 {
        let mut bytes = [0u8; 34];

        let chain_id: u16 = self.chain_id.get().to::<u16>();
        // now you can use `chain_id` as a regular u16
        let chain_id_bytes = chain_id.to_be_bytes();
        
        bytes[0..2].copy_from_slice(&chain_id_bytes);
        bytes[2..].copy_from_slice(self.emitter_address.get().as_slice());

        keccak256(bytes).to_slot(root)
    }
}

impl StorageKey for DataSource {
    fn to_slot(&self, root: B256) -> U256 {
        let mut bytes = [0u8; 34];

        let chain_id: u16 = self.chain_id.to::<u16>();
        // now you can use `chain_id` as a regular u16
        let chain_id_bytes = chain_id.to_be_bytes();
        
        bytes[0..2].copy_from_slice(&chain_id_bytes);
        bytes[2..].copy_from_slice(self.emitter_address.as_slice());

        keccak256(bytes).to_slot(root)
    }
}

// pub trait GetDataSource {
//     fn data_source(&self) -> DataSourceStorage;
// }

// impl GetDataSource for VerifiedVM {
//     fn data_source(&self) -> DataSourceStorage {
//         let mut ds = DataSourceStorage {
//             chain_id: StorageU16::new(storage_key!("chain_id")),
//             emitter_address: StorageFixedBytes::<32>::new(storage_key!("emitter_address")),
//         };
//         ds.chain_id.set(self.emitter_chain_id.into());
//         ds.emitter_address.set(self.emitter_address);
//         ds
//     }
// }

// PriceInfo struct storing price information
#[storage]
pub struct PriceInfoStorage {
    pub publish_time: StorageU64,
    pub expo: StorageI32,
    pub price: StorageI64,
    pub conf: StorageU64,
    pub ema_price: StorageI64,
    pub ema_conf: StorageU64,
}

pub struct PriceInfo {
    pub publish_time: U64,
    pub expo: I32,
    pub price: I64,
    pub conf: U64,
    pub ema_price: I64,
    pub ema_conf: U64,
}

impl From<&PriceFeedMessage> for PriceInfo {
    fn from(price_feed_message: &PriceFeedMessage) -> Self {
        Self {
            publish_time: U64::from(price_feed_message.publish_time),
            expo: I32::from_be_bytes(price_feed_message.exponent.to_be_bytes()),
            price: I64::from_be_bytes(price_feed_message.price.to_be_bytes()),
            conf: U64::from(price_feed_message.conf),
            ema_price: I64::from_be_bytes(price_feed_message.ema_price.to_be_bytes()),
            ema_conf: U64::from(price_feed_message.ema_conf),
        }
    }
}

// PriceInfo struct storing price information
pub type PriceInfoReturn = (U64, I32, I64, U64, I64, U64);