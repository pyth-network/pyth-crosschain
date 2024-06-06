use super::{GetPriceUnsafeError, GetPriceNoOlderThanError};
use pyth::byte_array::ByteArray;
use pyth::wormhole::VerifiedVM;
use core::starknet::ContractAddress;

#[starknet::interface]
pub trait IPyth<T> {
    fn get_price_no_older_than(
        self: @T, price_id: u256, age: u64
    ) -> Result<Price, GetPriceNoOlderThanError>;
    fn get_price_unsafe(self: @T, price_id: u256) -> Result<Price, GetPriceUnsafeError>;
    fn get_ema_price_no_older_than(
        self: @T, price_id: u256, age: u64
    ) -> Result<Price, GetPriceNoOlderThanError>;
    fn get_ema_price_unsafe(self: @T, price_id: u256) -> Result<Price, GetPriceUnsafeError>;
    fn query_price_feed_no_older_than(
        self: @T, price_id: u256, age: u64
    ) -> Result<PriceFeed, GetPriceNoOlderThanError>;
    fn query_price_feed_unsafe(self: @T, price_id: u256) -> Result<PriceFeed, GetPriceUnsafeError>;
    fn price_feed_exists(self: @T, price_id: u256) -> bool;
    fn latest_price_info_publish_time(self: @T, price_id: u256) -> u64;

    fn update_price_feeds(ref self: T, data: ByteArray);
    fn update_price_feeds_if_necessary(
        ref self: T, update: ByteArray, required_publish_times: Array<PriceFeedPublishTime>
    );
    fn parse_price_feed_updates(
        ref self: T,
        data: ByteArray,
        price_ids: Array<u256>,
        min_publish_time: u64,
        max_publish_time: u64
    ) -> Array<PriceFeed>;
    fn parse_unique_price_feed_updates(
        ref self: T, data: ByteArray, price_ids: Array<u256>, publish_time: u64, max_staleness: u64,
    ) -> Array<PriceFeed>;
    fn get_update_fee(self: @T, data: ByteArray, token: ContractAddress) -> u256;
    fn wormhole_address(self: @T) -> ContractAddress;
    fn fee_token_addresses(self: @T) -> Array<ContractAddress>;
    fn get_single_update_fee(self: @T, token: ContractAddress) -> u256;
    fn valid_data_sources(self: @T) -> Array<DataSource>;
    fn is_valid_data_source(self: @T, source: DataSource) -> bool;
    fn governance_data_source(self: @T) -> DataSource;
    fn is_valid_governance_data_source(self: @T, source: DataSource) -> bool;
    fn last_executed_governance_sequence(self: @T) -> u64;
    fn governance_data_source_index(self: @T) -> u32;
    fn chain_id(self: @T) -> u16;

    fn execute_governance_instruction(ref self: T, data: ByteArray);
    fn version(self: @T) -> felt252;
    fn pyth_upgradable_magic(self: @T) -> u32;
}

#[derive(Drop, Debug, Clone, Copy, PartialEq, Hash, Default, Serde, starknet::Store)]
pub struct DataSource {
    pub emitter_chain_id: u16,
    pub emitter_address: u256,
}

pub trait GetDataSource<T> {
    fn data_source(self: @T) -> DataSource;
}

impl GetDataSourceFromVerifiedVM of GetDataSource<VerifiedVM> {
    fn data_source(self: @VerifiedVM) -> DataSource {
        DataSource {
            emitter_chain_id: *self.emitter_chain_id, emitter_address: *self.emitter_address
        }
    }
}

#[derive(Drop, Copy, PartialEq, Serde)]
pub struct Price {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
}

#[derive(Drop, Clone, Serde)]
pub struct PriceFeedPublishTime {
    pub price_id: u256,
    pub publish_time: u64,
}

// PriceFeed represents a current aggregate price from pyth publisher feeds.
#[derive(Drop, Copy, PartialEq, Serde)]
pub struct PriceFeed {
    // The price ID.
    pub id: u256,
    // Latest available price
    pub price: Price,
    // Latest available exponentially-weighted moving average price
    pub ema_price: Price,
}
