use alloc::vec::Vec;
use alloy_primitives::{U64, U8};
use alloy_primitives::{Bytes, FixedBytes};
use stylus_proc::{public,external, sol_interface};
use crate::structs::{Price, PriceFeed};


sol_interface! {
    interface IPythMethod {
        function updatePriceFeeds(bytes[] calldata updateData) external payable;
        function updatePriceFeedsIfNecessary(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64[] calldata publishTimes
        ) external payable;

        function getUpdateFee(
            bytes[] calldata updateData
        ) external view returns (uint feeAmount);
    }
}

pub trait IPyth {
    type Error: Into<alloc::vec::Vec<u8>>;
    fn get_price_unsafe()->Result<Price, Self::Error>;
    fn get_price_no_older_than(id:Vec<FixedBytes<32>>, age:U8) -> Result<Price, Self::Error>;
    fn get_ema_price_unsafe(id:FixedBytes<32>) -> Result<Price, Self::Error>;
    fn update_price_feeds(&mut self, update_data: Vec<Bytes>) -> Result<(), Self::Error>;
    fn update_price_feeds_if_necessary(&mut self, update_data: Vec<Bytes>, price_ids: Vec<FixedBytes<32>>, publish_times: Vec<U64>) -> Result<(), Self::Error>;
    fn get_update_fee(&self, update_data: Vec<Bytes>) -> Result<u8, Self::Error>;
    fn parse_price_feed_updates(update_data:Vec<Bytes>, price_ids:Vec<FixedBytes<32>>,min_publish_time:U64,max_publish_time:U64) -> Result<Vec<PriceFeed>, Self::Error>;
    fn parse_price_feed_updates_unique(update_data:Vec<Bytes>,price_ids:Vec<FixedBytes<32>>,min_publish_time:U64,max_publish_time:U64)->Result<PriceFeed, Self::Error>;
}



