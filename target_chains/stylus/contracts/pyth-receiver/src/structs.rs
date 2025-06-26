use alloc::vec::Vec;
use stylus_sdk::{prelude::*, storage::{StorageU16, StorageU64, StorageI32, StorageI64, StorageFixedBytes}};
use stylus_sdk::alloy_primitives::{U64, I32, I64};

// DataSource struct to store chain/emitter pairs
#[storage]
pub struct DataSourceStorage {
    pub chain_id: StorageU16,
    pub emitter_address: StorageFixedBytes<32>,
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