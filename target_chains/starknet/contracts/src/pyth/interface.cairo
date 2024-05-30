use super::{GetPriceUnsafeError, GetPriceNoOlderThanError};
use pyth::byte_array::ByteArray;

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
    fn get_update_fee(self: @T, data: ByteArray) -> u256;
    fn execute_governance_instruction(ref self: T, data: ByteArray);
    fn pyth_upgradable_magic(self: @T) -> u32;
}

#[derive(Drop, Debug, Clone, Copy, PartialEq, Hash, Default, Serde, starknet::Store)]
pub struct DataSource {
    pub emitter_chain_id: u16,
    pub emitter_address: u256,
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
