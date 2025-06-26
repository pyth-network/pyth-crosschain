// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

mod structs;
mod error;

use alloc::vec::Vec;
use stylus_sdk::{alloy_primitives::{U16, U32, U256, U64, I32, I64, FixedBytes, Bytes, Address},
                prelude::*, 
                storage::{StorageAddress, StorageVec, StorageMap, StorageUint, StorageBool, StorageU256, StorageU16, StorageFixedBytes},
                call::Call};

use structs::{PriceInfoReturn, PriceInfoStorage, DataSourceStorage};
use error::{PythReceiverError};
use pythnet_sdk::{wire::{v1::{
            AccumulatorUpdateData, Proof,
        },
    },
};

sol_interface! {
    interface IWormholeContract {
        function initialize(address[] memory initial_guardians, uint16 chain_id, uint16 governance_chain_id, address governance_contract) external;
        function getGuardianSet(uint32 index) external view returns (uint8[] memory);
        function parseAndVerifyVm(uint8[] memory encoded_vaa) external view returns (uint8[] memory);
        function quorum(uint32 num_guardians) external pure returns (uint32);
    }
}

#[storage]
#[entrypoint]
pub struct PythReceiver {
    pub wormhole: StorageAddress,
    pub valid_data_sources: StorageVec<DataSourceStorage>,
    pub is_valid_data_source: StorageMap<FixedBytes<32>, StorageBool>,
    pub single_update_fee_in_wei: StorageU256,
    pub valid_time_period_seconds: StorageU256,
    pub governance_data_source_chain_id: StorageU16,
    pub governance_data_source_emitter_address: StorageFixedBytes<32>,
    pub last_executed_governance_sequence: StorageUint<64, 1>,
    pub governance_data_source_index: StorageUint<32, 1>,
    pub latest_price_info: StorageMap<FixedBytes<32>, PriceInfoStorage>,
    pub transaction_fee_in_wei: StorageU256,
}

#[public]
impl PythReceiver {
    pub fn initialize(&mut self, _wormhole: Address, _single_update_fee_in_wei: U256, _valid_time_period_seconds: U256,
                            data_source_emitter_chain_ids: Vec<u16>, data_source_emitter_addresses: Vec<[u8; 32]>,
                            governance_emitter_chain_id: u16, governance_emitter_address: [u8; 32], 
                            governance_initial_sequence: u64, _data: Vec<u8>) {
        self.wormhole.set(_wormhole);
        self.single_update_fee_in_wei.set(_single_update_fee_in_wei);
        self.valid_time_period_seconds.set(_valid_time_period_seconds);

        self.governance_data_source_chain_id.set(U16::from(governance_emitter_chain_id));
        self.governance_data_source_emitter_address.set(FixedBytes::<32>::from(governance_emitter_address));
        
        // Initialize other fields
        self.last_executed_governance_sequence.set(U64::from(governance_initial_sequence));
        self.governance_data_source_index.set(U32::ZERO);

        for (i, chain_id) in data_source_emitter_chain_ids.iter().enumerate() {
            let emitter_address = FixedBytes::<32>::from(data_source_emitter_addresses[i]);
            
            // Create a new data source storage slot
            let mut data_source = self.valid_data_sources.grow();
            data_source.chain_id.set(U16::from(*chain_id));
            data_source.emitter_address.set(emitter_address);
            
            self.is_valid_data_source
                .setter(emitter_address)
                .set(true);
        }
    }
    
    pub fn get_price_unsafe(&self, _id: [u8; 32]) -> Result<PriceInfoReturn, PythReceiverError> {
        let id_fb = FixedBytes::<32>::from(_id);
        
        let price_info = self.latest_price_info.get(id_fb);
        
        if price_info.publish_time.get() == U64::ZERO {
            return Err(PythReceiverError::PriceUnavailable);
        }

        Ok((
            price_info.publish_time.get(),
            price_info.expo.get(),
            price_info.price.get(),
            price_info.conf.get(),
            price_info.ema_price.get(),
            price_info.ema_conf.get(),
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

    pub fn update_price_feeds(&mut self, update_data: Vec<u8>) {
        let update_data_array: &[u8] = &update_data;
        let update_data = AccumulatorUpdateData::try_from_slice(&update_data_array).unwrap();

        match update_data.proof {
            Proof::WormholeMerkle { vaa, updates } => {
                let wormhole: IWormholeContract = IWormholeContract::new(self.wormhole.get());
                let config = Call::new_in(self);
                let _parsed_vaa = wormhole.parse_and_verify_vm(config, Bytes::from(Vec::from(vaa))).map_err(|_| PythReceiverError::PriceUnavailable).unwrap();

                if !self.is_valid_data_source.entry(_parsed_vaa.data_source()).read() {
                    panic!("Update data source is not a valid data source.");
                }

                for update in updates {
                    // fill in update processing logic.
                    // update is a merkle price update
                    let message = update.message;
                    let proof = update.proof;

                    
                }
            }
        };
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
