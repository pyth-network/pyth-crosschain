#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;
use alloy_primitives::{Bytes, U256};
use stylus_sdk::{console,  prelude::{entrypoint,public, sol_storage, SolidityError}};
use pyth_stylus::pyth::{functions::{
    create_price_feed_update_data, get_ema_price_no_older_than, get_ema_price_unsafe, get_price_no_older_than, get_price_unsafe, get_update_fee, get_valid_time_period, update_price_feeds, update_price_feeds_if_necessary
},types::{
    StoragePrice, 
    StoragePriceFeed
}};
use alloy_sol_types::sol;


sol_storage! {
    #[entrypoint]
    struct FunctionCallsExample {
        address pyth_address;
        bytes32 price_id;
        StoragePrice price;
        StoragePriceFeed price_feed;
        StoragePrice ema_price;
        StoragePriceFeed ema_price_feed;
    }
}


sol! {

    error ArraySizeNotMatch();

    error CallFailed();

}

#[derive(SolidityError)]
pub enum MultiCallErrors {

    ArraySizeNotMatch(ArraySizeNotMatch),

    CallFailed(CallFailed),

}


#[public]
impl FunctionCallsExample {
    pub fn get_price_unsafe(&mut self) -> Result<(), Vec<u8>> {
       let price =  get_price_unsafe(self, self.pyth_address.get(), self.price_id.get())?;
       if price.price > 0 {
          return Ok(());
       }
        Err(MultiCallErrors::CallFailed(CallFailed{}).into())
    }

    pub fn get_ema_price_unsafe(&mut self) -> Result<(), Vec<u8>> {
       let _ =  get_ema_price_unsafe(self, self.pyth_address.get(), self.price_id.get())?;
       Ok(())
    }
    pub fn get_price_no_older_than(&mut self) -> Result<(), Vec<u8>> {
       let _ =  get_price_no_older_than(self, self.pyth_address.get(), self.price_id.get(), U256::from(1000))?;
       Ok(())
    }

    pub fn get_ema_price_no_older_than(&mut self) -> Result<(), Vec<u8>> {
       let _ =  get_ema_price_no_older_than(self, self.pyth_address.get(), self.price_id.get(), U256::from(1000))?;
       Ok(())
    }

    pub fn get_update_fee(&mut self) -> Result<U256, Vec<u8>> {
       let data  = create_price_feed_update_data(self.price_id.get(), 10, 100, 100, 100, 100, U256::from(100), 0);
       let data_bytes: Vec<Bytes> = data.iter().map(|&x| {Bytes::from(vec![x]) }).collect();
       let fee =  get_update_fee(self, self.pyth_address.get(), data_bytes)?;
       Ok(fee)
    }

    pub fn get_valid_time_period(&mut self) -> Result<(), Vec<u8>> {
       let _ =  get_valid_time_period(self, self.pyth_address.get())?;
       Ok(())
    }

    #[payable]
    pub fn update_price_feeds(&mut self) -> Result<(), Vec<u8>> {
       let data  = create_price_feed_update_data(self.price_id.get(), 10, 100, 100, 100, 100, U256::from(100), 0);
       let data_bytes: Vec<Bytes> = data.iter().map(|&x| {Bytes::from(vec![x]) }).collect();
       let _ =  update_price_feeds(self, self.pyth_address.get(), data_bytes)?;
       Ok(())
    }

    #[payable]
    pub fn update_price_feeds_if_necessary(&mut self) -> Result<(), Vec<u8>> {
       let data  = create_price_feed_update_data(self.price_id.get(), 10, 100, 100, 100, 100, U256::from(100), 0);
       let data_bytes: Vec<Bytes> = data.iter().map(|&x| {Bytes::from(vec![x]) }).collect();
       let _ =  update_price_feeds_if_necessary(self, self.pyth_address.get(), data_bytes, vec![self.price_id.get()],vec![0])?;
       Ok(())
    }


}