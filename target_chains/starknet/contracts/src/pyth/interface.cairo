use core::fmt::{Debug, Formatter};
use pyth::byte_buffer::ByteBuffer;
use pyth::util::write_i64;
use pyth::wormhole::VerifiedVM;
use starknet::ContractAddress;
use super::{GetPriceNoOlderThanError, GetPriceUnsafeError};

#[starknet::interface]
pub trait IPyth<T> {
    fn get_price_no_older_than(
        self: @T, price_id: u256, age: u64,
    ) -> Result<Price, GetPriceNoOlderThanError>;
    fn get_price_unsafe(self: @T, price_id: u256) -> Result<Price, GetPriceUnsafeError>;
    fn get_ema_price_no_older_than(
        self: @T, price_id: u256, age: u64,
    ) -> Result<Price, GetPriceNoOlderThanError>;
    fn get_ema_price_unsafe(self: @T, price_id: u256) -> Result<Price, GetPriceUnsafeError>;
    fn query_price_feed_no_older_than(
        self: @T, price_id: u256, age: u64,
    ) -> Result<PriceFeed, GetPriceNoOlderThanError>;
    fn query_price_feed_unsafe(self: @T, price_id: u256) -> Result<PriceFeed, GetPriceUnsafeError>;
    fn price_feed_exists(self: @T, price_id: u256) -> bool;
    fn latest_price_info_publish_time(self: @T, price_id: u256) -> u64;

    fn update_price_feeds(ref self: T, data: ByteBuffer);
    fn update_price_feeds_if_necessary(
        ref self: T, update: ByteBuffer, required_publish_times: Array<PriceFeedPublishTime>,
    );
    fn parse_price_feed_updates(
        ref self: T,
        data: ByteBuffer,
        price_ids: Array<u256>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Array<PriceFeed>;
    fn parse_unique_price_feed_updates(
        ref self: T,
        data: ByteBuffer,
        price_ids: Array<u256>,
        publish_time: u64,
        max_staleness: u64,
    ) -> Array<PriceFeed>;
    fn get_update_fee(self: @T, data: ByteBuffer, token: ContractAddress) -> u256;
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

    fn execute_governance_instruction(ref self: T, data: ByteBuffer);
    fn version(self: @T) -> felt252;
    fn pyth_upgradable_magic(self: @T) -> u32;
}

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash, Default, starknet::Store)]
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
            emitter_chain_id: *self.emitter_chain_id, emitter_address: *self.emitter_address,
        }
    }
}

#[derive(Drop, Copy, PartialEq, Serde, Hash, starknet::Store)]
pub struct Price {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
}

// TODO: use derives after upgrading cairo
impl DebugPrice of Debug<Price> {
    fn fmt(self: @Price, ref f: Formatter) -> Result<(), core::fmt::Error> {
        write!(f, "Price {{ price: ")?;
        write_i64(ref f, *self.price)?;
        write!(f, ", conf: {}, expo: ", self.conf)?;
        write_i64(ref f, (*self.expo).into())?;
        write!(f, ", publish_time: {} }}", self.publish_time)
    }
}

#[cfg(test)]
#[test]
fn test_debug_price() {
    let value = Price { price: 2, conf: 3, expo: -4, publish_time: 5 };
    let expected = "Price { price: 2, conf: 3, expo: -4, publish_time: 5 }";
    let actual = format!("{:?}", value);
    assert!(actual == expected);
}

impl DefaultPrice of Default<Price> {
    fn default() -> Price {
        Price { price: 0, conf: 0, expo: 0, publish_time: 0 }
    }
}

#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash, starknet::Store)]
pub struct PriceFeedPublishTime {
    pub price_id: u256,
    pub publish_time: u64,
}

// PriceFeed represents a current aggregate price from pyth publisher feeds.
#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash, starknet::Store)]
pub struct PriceFeed {
    // The price ID.
    pub id: u256,
    // Latest available price
    pub price: Price,
    // Latest available exponentially-weighted moving average price
    pub ema_price: Price,
}
