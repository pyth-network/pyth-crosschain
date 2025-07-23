// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

mod error;
mod governance;
mod governance_structs;
#[cfg(test)]
mod integration_tests;
mod pyth_operations;
#[cfg(test)]
mod pyth_governance_test;
mod structs;
#[cfg(test)]
mod test_data;

#[cfg(test)]
use mock_instant::global::MockClock;

use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, FixedBytes, U16, U256, U32, U64},
    alloy_sol_types::sol,
    prelude::*,
    storage::{
        StorageAddress, StorageBool, StorageFixedBytes, StorageMap, StorageU16, StorageU256,
        StorageUint, StorageVec,
    },
};

use structs::{DataSource, DataSourceStorage, PriceFeedStorage};

sol! {
    event FeeSet(uint256 indexed old_fee, uint256 indexed new_fee);
    event TransactionFeeSet(uint256 indexed old_fee, uint256 indexed new_fee);
    event FeeWithdrawn(address indexed target_address, uint256 fee_amount);
    event ValidPeriodSet(uint256 indexed old_valid_period, uint256 indexed new_valid_period);
    event DataSourcesSet(bytes32[] old_data_sources, bytes32[] new_data_sources);
    event GovernanceDataSourceSet(uint16 old_chain_id, bytes32 old_emitter_address, uint16 new_chain_id, bytes32 new_emitter_address, uint64 initial_sequence);
}

sol_interface! {
    interface IWormholeContract  {
    function initialize(address[] memory initial_guardians, uint32 initial_guardian_set_index, uint16 chain_id, uint16 governance_chain_id, address governance_contract) external;
    function getGuardianSet(uint32 index) external view returns (uint8[] memory);
    function parseAndVerifyVm(uint8[] memory encoded_vaa) external view returns (uint8[] memory);
    function quorum(uint32 num_guardians) external pure returns (uint32);
    function chainId() external view returns (uint16);
}
}

#[storage]
#[entrypoint]
pub struct PythReceiver {
    pub wormhole: StorageAddress,
    pub valid_data_sources: StorageVec<DataSourceStorage>,
    pub is_valid_data_source: StorageMap<DataSource, StorageBool>,
    pub single_update_fee_in_wei: StorageU256,
    pub valid_time_period_seconds: StorageU256,
    pub governance_data_source_chain_id: StorageU16,
    pub governance_data_source_emitter_address: StorageFixedBytes<32>,
    pub last_executed_governance_sequence: StorageUint<64, 1>,
    pub governance_data_source_index: StorageUint<32, 1>,
    pub latest_price_info: StorageMap<FixedBytes<32>, PriceFeedStorage>,
    pub transaction_fee_in_wei: StorageU256,
}

#[public]
impl PythReceiver {
    pub fn initialize(
        &mut self,
        wormhole: Address,
        single_update_fee_in_wei: U256,
        valid_time_period_seconds: U256,
        data_source_emitter_chain_ids: Vec<u16>,
        data_source_emitter_addresses: Vec<[u8; 32]>,
        governance_emitter_chain_id: u16,
        governance_emitter_address: [u8; 32],
        governance_initial_sequence: u64,
    ) {
        self.wormhole.set(wormhole);
        self.single_update_fee_in_wei.set(single_update_fee_in_wei);
        self.valid_time_period_seconds
            .set(valid_time_period_seconds);

        self.governance_data_source_chain_id
            .set(U16::from(governance_emitter_chain_id));
        self.governance_data_source_emitter_address
            .set(FixedBytes::<32>::from(governance_emitter_address));

        self.last_executed_governance_sequence
            .set(U64::from(governance_initial_sequence));
        self.governance_data_source_index.set(U32::ZERO);

        for (i, chain_id) in data_source_emitter_chain_ids.iter().enumerate() {
            let emitter_address = FixedBytes::<32>::from(data_source_emitter_addresses[i]);

            let mut data_source = self.valid_data_sources.grow();
            data_source.chain_id.set(U16::from(*chain_id));
            data_source.emitter_address.set(emitter_address);

            let data_source_key = DataSource {
                chain_id: U16::from(*chain_id),
                emitter_address: emitter_address,
            };

            self.is_valid_data_source.setter(data_source_key).set(true);
        }
    }


    fn is_no_older_than(&self, publish_time: U64, max_age: u64) -> bool {
        self.get_current_timestamp()
            .saturating_sub(publish_time.to::<u64>())
            <= max_age
    }

    // Stylus doesn't provide a way to mock up the testing timestamp
    // so at the moment I'm using the testing trait to let me test old timestamps
    fn get_current_timestamp(&self) -> u64 {
        #[cfg(test)]
        {
            MockClock::time().as_secs()
        }
        #[cfg(not(test))]
        {
            self.vm().block_timestamp()
        }
    }

    pub fn price_feed_exists(&self, id: [u8; 32]) -> bool {
        self.price_feed_exists_internal(id)
    }

    pub fn query_price_feed(&self, id: [u8; 32]) -> Result<structs::PriceFeedReturn, error::PythReceiverError> {
        self.query_price_feed_internal(id)
    }

    pub fn get_price_unsafe(&self, id: [u8; 32]) -> Result<structs::PriceReturn, error::PythReceiverError> {
        self.get_price_unsafe_internal(id)
    }

    pub fn get_price_no_older_than(&self, id: [u8; 32], age: u64) -> Result<structs::PriceReturn, error::PythReceiverError> {
        self.get_price_no_older_than_internal(id, age)
    }

    pub fn get_ema_price_unsafe(&self, id: [u8; 32]) -> Result<structs::PriceReturn, error::PythReceiverError> {
        self.get_ema_price_unsafe_internal(id)
    }

    pub fn get_ema_price_no_older_than(&self, id: [u8; 32], age: u64) -> Result<structs::PriceReturn, error::PythReceiverError> {
        self.get_ema_price_no_older_than_internal(id, age)
    }

    #[payable]
    pub fn update_price_feeds(&mut self, update_data: Vec<Vec<u8>>) -> Result<(), error::PythReceiverError> {
        self.update_price_feeds_internal(update_data)
    }

    pub fn update_price_feeds_if_necessary(&mut self, update_data: Vec<Vec<u8>>, price_ids: Vec<[u8; 32]>, publish_times: Vec<u64>) -> Result<(), error::PythReceiverError> {
        self.update_price_feeds_if_necessary_internal(update_data, price_ids, publish_times)
    }

    pub fn get_update_fee(&self, update_data: Vec<Vec<u8>>) -> Result<U256, error::PythReceiverError> {
        self.get_update_fee_internal(update_data)
    }

    pub fn get_twap_update_fee(&self, update_data: Vec<Vec<u8>>) -> U256 {
        self.get_twap_update_fee_internal(update_data)
    }

    pub fn parse_price_feed_updates(&mut self, update_data: Vec<u8>, price_ids: Vec<[u8; 32]>, min_publish_time: u64, max_publish_time: u64) -> Result<Vec<structs::PriceFeedReturn>, error::PythReceiverError> {
        self.parse_price_feed_updates_internal_wrapper(update_data, price_ids, min_publish_time, max_publish_time)
    }

    pub fn parse_price_feed_updates_with_config(&mut self, update_data: Vec<Vec<u8>>, price_ids: Vec<[u8; 32]>, min_allowed_publish_time: u64, max_allowed_publish_time: u64, check_uniqueness: bool, check_update_data_is_minimal: bool, store_updates_if_fresh: bool) -> Result<Vec<structs::PriceFeedReturn>, error::PythReceiverError> {
        self.parse_price_feed_updates_with_config_internal(update_data, price_ids, min_allowed_publish_time, max_allowed_publish_time, check_uniqueness, check_update_data_is_minimal, store_updates_if_fresh)
    }

    pub fn parse_twap_price_feed_updates(&mut self, update_data: Vec<Vec<u8>>, price_ids: Vec<[u8; 32]>) -> Vec<structs::PriceFeedReturn> {
        self.parse_twap_price_feed_updates_internal(update_data, price_ids)
    }

    pub fn parse_price_feed_updates_unique(&mut self, update_data: Vec<Vec<u8>>, price_ids: Vec<[u8; 32]>, min_publish_time: u64, max_publish_time: u64) -> Result<Vec<structs::PriceFeedReturn>, error::PythReceiverError> {
        self.parse_price_feed_updates_unique_internal(update_data, price_ids, min_publish_time, max_publish_time)
    }

    pub fn execute_governance_instruction(&mut self, encoded_vaa: Vec<u8>) -> Result<(), error::PythReceiverError> {
        self.execute_governance_instruction_internal(encoded_vaa)
    }

}
