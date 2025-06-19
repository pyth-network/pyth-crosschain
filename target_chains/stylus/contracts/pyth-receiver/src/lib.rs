// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

mod structs;
mod error;

use alloc::vec::Vec;
use stylus_sdk::{alloy_primitives::{U256, U64, I32, I64, FixedBytes},
                prelude::*, 
                storage::{StorageAddress, StorageVec, StorageMap, StorageUint, StorageBool, StorageU256}};

use structs::{DataSourceStorage, PriceInfoReturn, PriceInfoStorage};
use error::{PythReceiverError};

#[storage]
#[entrypoint]
pub struct PythReceiver {
    pub wormhole: StorageAddress,
    pub valid_data_sources: StorageVec<DataSourceStorage>,
    pub is_valid_data_source: StorageMap<FixedBytes<32>, StorageBool>,
    pub single_update_fee_in_wei: StorageU256,
    pub valid_time_period_seconds: StorageU256,
    pub governance_data_source: DataSourceStorage,
    pub last_executed_governance_sequence: StorageUint<64, 1>,
    pub governance_data_source_index: StorageUint<32, 1>,
    pub latest_price_info: StorageMap<FixedBytes<32>, PriceInfoStorage>,
    pub transaction_fee_in_wei: StorageU256,
}

#[public]
impl PythReceiver {
    pub fn get_price_unsafe(&self, _id: [u8; 32]) -> Result<PriceInfoReturn, PythReceiverError> {
        let id_fb = FixedBytes::<32>::from(_id);
        
        let price_info = self.latest_price_info.get(id_fb).unwrap_or(PythReceiverError::PriceUnavailable)?;

        Ok((
            price_info.publish_time,
            price_info.expo,
            price_info.price,
            price_info.conf,
            price_info.ema_price,
            price_info.ema_conf,
        ))
    }

    pub fn get_price_no_older_than(&self, _id: [u8; 32], _age: u64) -> Result<PriceInfoReturn, PythReceiverError> {
        let price_info = self.get_price_unsafe(_id)?;
        if !self.is_no_older_than(price_info.0, _age) {
            return Err(PythReceiverError::PriceUnavailable);
        }
        Ok(price_info)
    }

    pub fn get_ema_price_unsafe(&self, _id: [u8; 32]) -> PriceInfoReturn {
        (U64::ZERO, I32::ZERO, I64::ZERO, U64::ZERO, I64::ZERO, U64::ZERO)
    }

    pub fn get_ema_price_no_older_than(&self, _id: [u8; 32], _age: u64) -> PriceInfoReturn {
        (U64::ZERO, I32::ZERO, I64::ZERO, U64::ZERO, I64::ZERO, U64::ZERO)
    }

    pub fn update_price_feeds(&mut self, _update_data: Vec<Vec<u8>>) {
        // dummy implementation
    }

    pub fn update_price_feeds_if_necessary(
        &mut self,
        _update_data: Vec<Vec<u8>>,
        _price_ids: Vec<[u8; 32]>,
        _publish_times: Vec<u64>,
    ) {
        // dummy implementation
    }

    pub fn get_update_fee(&self, _update_data: Vec<Vec<u8>>) -> U256 {
        U256::from(0u8)
    }

    pub fn get_twap_update_fee(&self, _update_data: Vec<Vec<u8>>) -> U256 {
        U256::from(0u8)
    }

    pub fn parse_price_feed_updates(
        &mut self,
        _update_data: Vec<Vec<u8>>,
        _price_ids: Vec<[u8; 32]>,
        _min_publish_time: u64,
        _max_publish_time: u64,
    ) -> Vec<PriceInfoReturn> {
        Vec::new()
    }

    pub fn parse_price_feed_updates_with_config(
        &mut self,
        _update_data: Vec<Vec<u8>>,
        _price_ids: Vec<[u8; 32]>,
        _min_allowed_publish_time: u64,
        _max_allowed_publish_time: u64,
        _check_uniqueness: bool,
        _check_update_data_is_minimal: bool,
        _store_updates_if_fresh: bool,
    ) -> (Vec<PriceInfoReturn>, Vec<u64>) {
        (Vec::new(), Vec::new())
    }

    pub fn parse_twap_price_feed_updates(
        &mut self,
        _update_data: Vec<Vec<u8>>,
        _price_ids: Vec<[u8; 32]>,
    ) -> Vec<PriceInfoReturn> {
        Vec::new()
    }

    pub fn parse_price_feed_updates_unique(
        &mut self,
        _update_data: Vec<Vec<u8>>,
        _price_ids: Vec<[u8; 32]>,
        _min_publish_time: u64,
        _max_publish_time: u64,
    ) -> Vec<PriceInfoReturn> {
        Vec::new()
    }

    fn is_no_older_than(&self, publish_time: U64, max_age: u64) -> bool {
        let current_u64: u64 = self.vm().block_timestamp();
        let publish_time_u64: u64 = publish_time.to::<u64>();
        
        current_u64.saturating_sub(publish_time_u64) <= max_age
    }
}
