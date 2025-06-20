use alloc::vec::Vec;
use stylus_sdk::{prelude::*, storage::{StorageU64, StorageI32, StorageI64, StorageU16, StorageFixedBytes}};
use stylus_sdk::alloy_primitives::{U64, I32, I64, U16, FixedBytes};
use wormhole_contract::types::VerifiedVM;

#[storage]
pub struct DataSourceStorage {
    pub chain_id: StorageU16,
    pub emitter_address: StorageFixedBytes<32>,
}

pub trait GetDataSource {
    fn data_source(&self) -> DataSourceStorage;
}

impl GetDataSource for VerifiedVM {
    fn data_source(&self) -> DataSourceStorage {
        let mut ds = DataSourceStorage {
            chain_id: StorageU16::default(),
            emitter_address: StorageFixedBytes::<32>::default(),
        };
        ds.chain_id.set(U16::from(self.emitter_chain_id));
        ds.emitter_address.set(self.emitter_address);
        ds
    }
}

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

// PriceInfo struct storing price information
pub type PriceInfoReturn = (U64, I32, I64, U64, I64, U64);