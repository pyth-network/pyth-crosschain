use stylus_proc::{public, sol_storage};

use crate::pyth::ipyth::IPyth;
use crate::pyth::errors::IPythError;
use crate::pyth::structs::{Price, PriceFeed};
use alloc::vec::Vec;
use alloy_primitives::{Bytes, FixedBytes,U64, U8};

use crate::utils::helpers::call_helper;

use super::solidity::{getPriceUnsafeCall};

sol_storage! {
    pub struct  AbstractPyth {
        address _ipyth;
    }
}

#[public]
impl IPyth for AbstractPyth {
    type Error = IPythError;

    fn get_price_unsafe(id:FixedBytes<32>)->Result<Price, Self::Error>{
      return Self::_get_price_unsafe(id)
    }

    fn get_price_no_older_than(id:FixedBytes<32>, age:U8) -> Result<Price, Self::Error> {

    }
    fn get_ema_price_unsafe(id:FixedBytes<32>) -> Result<Price, Self::Error> {

    }
    fn update_price_feeds(&mut self, update_data: Vec<Bytes>) -> Result<(), Self::Error> {

    }
    fn update_price_feeds_if_necessary(&mut self, update_data: Vec<Bytes>, price_ids: Vec<FixedBytes<32>>, publish_times: Vec<U64>) -> Result<(), Self::Error> {

    }
    fn get_update_fee(&self, update_data: Vec<Bytes>) -> Result<u8, Self::Error> {

    }
    fn parse_price_feed_updates(update_data:Vec<Bytes>, price_ids:Vec<FixedBytes<32>>,min_publish_time:U64,max_publish_time:U64) -> Result<Vec<PriceFeed>, Self::Error>{

    }

    fn parse_price_feed_updates_unique(update_data:Vec<Bytes>,price_ids:Vec<FixedBytes<32>>,min_publish_time:U64,max_publish_time:U64)->Result<PriceFeed, Self::Error> {

    }
}

impl AbstractPyth {
    fn _get_price_unsafe(id:FixedBytes<32>)->Result<Price, IPythError> {
        //self._ipyth
       //call_helper::<getPriceUnsafeCall>(&self._ipyth, id, ()).map_err(|e| e.into())
       
    }
    fn _get_price_no_older_than(id:Vec<FixedBytes<32>>, age:U8) -> Result<Price, Self::Error>{

    }
    // fn get_ema_price_unsafe(id:FixedBytes<32>) -> Result<Price, Self::Error>;
    // fn update_price_feeds(&mut self, update_data: Vec<Bytes>) -> Result<(), Self::Error> ;
    // fn update_price_feeds_if_necessary(&mut self, update_data: Vec<Bytes>, price_ids: Vec<FixedBytes<32>>, publish_times: Vec<U64>) -> Result<(), Self::Error>;
    // fn get_update_fee(&self, update_data: Vec<Bytes>) -> Result<u8, Self::Error> ;
    // fn parse_price_feed_updates(update_data:Vec<Bytes>, price_ids:Vec<FixedBytes<32>>,min_publish_time:U64,max_publish_time:U64) -> Result<Vec<PriceFeed>, Self::Error>;
    // fn parse_price_feed_updates_unique(update_data:Vec<Bytes>,price_ids:Vec<FixedBytes<32>>,min_publish_time:U64,max_publish_time:U64)->Result<PriceFeed, Self::Error>;      
}