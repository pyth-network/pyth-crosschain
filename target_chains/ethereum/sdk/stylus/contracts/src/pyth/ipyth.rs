use alloc::vec::Vec;
use alloy_primitives::U256;
use stylus_sdk::{abi::Bytes, alloy_primitives::FixedBytes};

pub trait IPyth {
    type Error: Into<alloc::vec::Vec<u8>>;

    fn get_price_unsafe(&mut self, id: FixedBytes<32>) -> Result<Vec<u8>, Self::Error>;

    fn get_price_no_older_than(&mut self,id: FixedBytes<32>, age: u8) -> Result<Vec<u8>, Self::Error>;

    fn get_ema_price_unsafe(&mut self, id: FixedBytes<32>) -> Result<Vec<u8>, Self::Error>;
    
    fn get_ema_price_no_older_than(&mut self, id: FixedBytes<32>, age: u8) -> Result<Vec<u8>, Self::Error>;

    fn update_price_feeds(&mut self, update_data: Vec<Bytes>) -> Result<(), Self::Error>;

    fn update_price_feeds_if_necessary(
        &mut self,
        update_data: Vec<Bytes>,
        price_ids: Vec<FixedBytes<32>>,
        publish_times: Vec<u64>,
    ) -> Result<(), Self::Error>;

    fn get_update_fee(&mut self, update_data: Vec<Bytes>) -> Result<U256, Self::Error>;

    fn parse_price_feed_updates(
        &mut self,
        update_data: Vec<Bytes>,
        price_ids: Vec<FixedBytes<32>>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<u8>, Self::Error>;


    fn parse_price_feed_updates_unique(
        &mut self,
        update_data: Vec<Bytes>,
        price_ids: Vec<FixedBytes<32>>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<u8>, Self::Error>;


}
